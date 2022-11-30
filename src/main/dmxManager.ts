/*
 *  Copyright (C) 2022  Daniel Farquharson
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, version 3 (GPLv3)
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  See https://github.com/PenumbraProduction/lx_console_app/blob/main/LICENSE an
 *  implementation of GPLv3 (https://www.gnu.org/licenses/gpl-3.0.html)
 */

import { ipcMain } from "electron";
export { desk } from "lx_console_backend";
import {
	desk,
	Channel,
	ChannelAddress,
	CuePaletteItem,
	DefinedProfile,
	FixtureChannel,
	FixtureChannelType,
	GenericPaletteItem,
	GroupPaletteItem,
	Palette,
	ProfileTypeIdentifier,
	StackCue,
	StackCueSourceType,
	StackCueData
} from "lx_console_backend";
import { Universe } from "dmxuniverse";
import { getChannelTypeMappingForward, getChannelTypeMappingBackward, getTypes } from "./OFLManager";
import { mainWindow } from "./main";

function ipcSend(channel: string, ...args: any[]) {
	mainWindow.webContents.send(channel, ...args);
}

const universe = new Universe();

export async function init() {
	const port = await Universe.findInterfacePort().catch(() => null); // (e) => console.log(e)
	if (port) await universe.init(port.path);
}

export async function close() {
	await universe.close().catch((e) => console.log(e));
}

export function serializeAll() {
	return { empty: "object" };
}

const serialport = {
	opening: false,
	isOpen: false
};

universe.on("bufferUpdate", (data) => {
	if (!data) data = universe.getUniverseData();
	ipcSend("bufferUpdate", data);
});
universe.on("serialportOpening", () => {
	serialport.opening = true;
	ipcSend("serialportOpening");
});
universe.on("serialportOpeningFailed", (e: Error) => {
	serialport.opening = false;
	ipcSend("serialportOpeningFailed", e);
});
universe.on("serialportOpen", () => {
	serialport.opening = false;
	serialport.isOpen = true;
	universe.on("serialportClose", serialportCloseListener);
	ipcSend("serialportOpen");
});
function serialportCloseListener() {
	serialport.isOpen = false;
	ipcSend("serialportClose");
}
universe.on("serialportError", async (e: Error) => {
	serialport.isOpen = false;
	universe.off("serialportClose", serialportCloseListener);
	await universe.close().catch((e) => console.log(e));
	ipcSend("serialportError", e);
});

ipcMain.on("retrySerialportInit", retrySerialportInit);
ipcMain.on("serialportClose", () => close());

export async function retrySerialportInit() {
	ipcSend("serialportRetry");
	if (!serialport.opening && !serialport.isOpen) {
		const port = await Universe.findInterfacePort().catch((e) => ipcSend("serialportRetryFail", e));
		if (port) await universe.init(port.path);
	}
}

// --------------- \\
// Channel Control \\
// --------------- \\

ipcMain.on("updateChannelsIntensity", (e, data) => {
	data.channels.forEach((ch: number) => {
		const channel = desk.patch.getChannel(ch);
		channel.setAddress(channel.getAddressFromType("INTENSITY"), data.value, true);
	});
});

ipcMain.on("updateChannelsAttribute", (e, data) => {
	data.channels.forEach((ch: any) => {
		const channel = desk.patch.getChannel(ch.channel);
		channel.setAddress(ch.addressOffset, ch.value, true);
	});
});

ipcMain.on("clearProgrammer", () => {
	desk.patch.clearProgrammerValues();
});

ipcMain.on("clearProgrammerChannel", (e, { channel }) => {
	desk.patch.getChannel(channel).clearProgrammerValues();
});

ipcMain.on("clearProgrammerAddress", (e, { channel, address }) => {
	desk.patch.getChannel(channel).clearProgrammerValue(address);
});

// ----- \\
// Patch \\
// ----- \\

desk.patch.on("patchAdd", (channel: Channel) =>
	ipcSend("patchAdd", {
		channel: channel.id,
		dmxAddressRange: channel.dmxAddressRange,
		name: channel.name,
		profile: { name: channel.profile.name, id: channel.profile.id }
	})
);
desk.patch.on("patchDelete", (id: number | Set<number>) => ipcSend("patchDelete", id));
desk.patch.on("patchMove", (id1: number, id2: number) => ipcSend("patchMove", id1, id2));

desk.patch.on("channelNameUpdate", (channel, name) => ipcSend("channelNameUpdate", channel, name));

desk.patch.on("addressUpdate", (address, value, channel, type, userInitiated) => {
	universe.update(address, value.programmerVal >= 0 ? value.programmerVal : value.val);
	ipcSend("addressUpdate", address, value, channel.id, type, userInitiated);
});

ipcMain.on("patchAdd", (e, id: number, profile: DefinedProfile, dmxAddressStart: number) => desk.patch.addChannel(id, profile, dmxAddressStart));
ipcMain.on("patchDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.patch.removeChannel(id) : desk.patch.removeChannels(id)));
ipcMain.on("patchMove", (e, id1: number, id2: number) => desk.patch.moveChannel(id1, id2));

ipcMain.on("patchChannelRename", (e, channel, name) => desk.patch.getChannel(channel).setName(name));

ipcMain.on("getChannel", (e, id: number) => (e.returnValue = Channel.serialize(desk.patch.getChannel(id))));
ipcMain.on("getChannels", (e, ids: Set<number>) => {
	const allowedData = new Map();
	desk.patch.getChannels(ids).forEach((v, k) => {
		allowedData.set(k, Channel.serialize(v));
	});
	e.returnValue = allowedData;
});

ipcMain.on("getAllChannels", (e) => {
	const allowedData = new Map();
	desk.patch.getAllChannels().forEach((v, k) => {
		allowedData.set(k, Channel.serialize(v));
	});
	e.returnValue = allowedData;
});

ipcMain.on("getChannelsByProfileType", (e, profileId, options?) => {
	const channels = desk.patch.getChannelsByProfileType(profileId, options);
	const allowedData = new Map();
	channels.forEach((v, k) => {
		allowedData.set(k, Channel.serialize(v));
	});
	e.returnValue = allowedData;
});

ipcMain.on("getChannelsMatchType", (e, channel: number, type: FixtureChannelType) => {
	const ch = desk.patch.getChannel(channel);
	// if (getChannelTypeMappingForward(type) !== "UNCATEGORISED") return (e.returnValue = ch.getChannelsMatchType(type));
	const types = getChannelTypeMappingBackward(type) as FixtureChannelType[];
	const returnChannels: FixtureChannel[] = [];
	types.forEach((t) => {
		returnChannels.push(...ch.getChannelsMatchType(t));
	});
	e.returnValue = returnChannels;
});

ipcMain.on("getPatchChannelNumbers", (e) => (e.returnValue = desk.patch.getAllChannelNumbers()));
ipcMain.on("getUsedDmxSpace", (e) => (e.returnValue = desk.patch.getUsedAddressSpace()));

// ------ \\
// Groups \\
// ------ \\

desk.groups.on("itemAdd", (group: GroupPaletteItem) => ipcSend("groupAdd", GroupPaletteItem.serialize(group)));
desk.groups.on("itemDelete", (id: number | Set<number>) => ipcSend("groupDelete", id));
desk.groups.on("itemMove", (id1: number, id2: number) => ipcSend("groupMove", id1, id2));

ipcMain.on("groupAdd", (e, id: number, channels: Set<number>) => desk.groups.addItem(new GroupPaletteItem(desk.groups.getPaletteData(), id, channels)));
ipcMain.on("groupDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.groups.removeItem(id) : desk.groups.removeItems(id)));
ipcMain.on("groupMove", (e, id1: number, id2: number) => desk.groups.moveItem(id1, id2));
ipcMain.on("getGroup", (e, id: number) => (e.returnValue = GroupPaletteItem.serialize(desk.groups.getItem(id))));
ipcMain.on("getGroups", (e, ids: Set<number>) => {
	const allowedData = new Map();
	desk.groups.getItems(ids).forEach((v, k) => {
		allowedData.set(k, GroupPaletteItem.serialize(v));
	});
	e.returnValue = allowedData;
});
ipcMain.on("getAllGroups", (e) => {
	const allowedData = new Map();
	desk.groups.getAllItems().forEach((v, k) => {
		allowedData.set(k, GroupPaletteItem.serialize(v));
	});
	e.returnValue = allowedData;
});

// -------- \\
// Palettes \\
// -------- \\

function getProfileIdentifierFromChannels(channels: Set<number>) {
	return Array.from(
		new Set(
			Array.from(channels).map((ch) => {
				const channel = desk.patch.getChannel(ch);
				return { id: channel.profile.id, options: channel.profile.options };
			})
		)
	);
}

function getProfileValuesFromCategory(category: string, selectedChannels: Set<number>): Map<ProfileTypeIdentifier, { addressOffset: number; value: number }> {
	const paletteData = new Map();
	selectedChannels.forEach((ch) => {
		(getChannelTypeMappingBackward(category) as FixtureChannelType[]).forEach((type) => {
			const channel = desk.patch.getChannel(ch);
			channel.getChannelsMatchType(type).forEach((address) => {
				const out = channel.output[address.addressOffset];
				if (out.programmerVal < 0) {
					return;
				}
				// ! This determines whether outputs set by playbacks are recorded into palettes
				// todo: turn this into a user defined setting
				const value = out.programmerVal >= 0 ? out.programmerVal : out.val;
				paletteData.set({ id: channel.profile.id, options: channel.profile.options }, { addressOffset: address.addressOffset, value });
			});
		});
	});
	return paletteData;
}

function getChannelValues(selectedChannels: Set<number>): Map<ChannelAddress, number> {
	const paletteData = new Map();
	selectedChannels.forEach((ch) => {
		const channel = desk.patch.getChannel(ch);
		channel.channelMap.forEach((address) => {
			const out = channel.output[address.addressOffset];
			if (out.programmerVal < 0) {
				return;
			}
			// ! This determines whether outputs set by playbacks are recorded into palettes
			// todo: turn this into a user defined setting
			const value = out.programmerVal >= 0 ? out.programmerVal : out.val;
			paletteData.set({ channel: channel.id, address: address.addressOffset }, value);
		});
	});
	return paletteData;
}

ipcMain.on("getProfileIdentifiersFromChannels", (e, channels) => (e.returnValue = getProfileIdentifierFromChannels(channels)));

ipcMain.on("getAllPalettes", (e, data) => {
	// ! is there not a way to make this cleaner?
	const categoryKey = data.category.toLowerCase() as keyof typeof desk;
	if (!desk[categoryKey]) return (e.returnValue = {});
	const allowedData = new Map();
	(desk[categoryKey] as Palette<any, any>).getAllItems().forEach((v, k) => {
		allowedData.set(k, GenericPaletteItem.serialize(v));
	});
	return (e.returnValue = allowedData);
});

// Colour \\

desk.colour.on("itemAdd", (item) => ipcSend("colourPaletteAdd", GenericPaletteItem.serialize(item as GenericPaletteItem)));
desk.colour.on("itemDelete", (id) => ipcSend("colourPaletteDelete", id));
desk.colour.on("itemMove", (id1: number, id2: number) => ipcSend("colourPaletteMove", id1, id2));
desk.colour.on("itemUpdate", (item) => ipcSend("colourPaletteUpdate", GenericPaletteItem.serialize(item as GenericPaletteItem)));

ipcMain.on("colourPaletteRecord", (e, paletteId: number, selectedChannels: Set<number>) => {
	const paletteData = getProfileValuesFromCategory("COLOUR", selectedChannels);
	desk.colour.addItem(new GenericPaletteItem(desk.colour.getPaletteData(), paletteId, paletteData));
});

ipcMain.on("colourPaletteDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.colour.removeItem(id) : desk.colour.removeItems(id)));
ipcMain.on("colourPaletteMove", (e, id1: number, id2: number) => desk.colour.moveItem(id1, id2));
ipcMain.on("colourPaletteName", (e, id: number, name: string) => desk.colour.getItem(id).setName(name));

// Beam \\

desk.beam.on("itemAdd", (item) => ipcSend("beamPaletteAdd", GenericPaletteItem.serialize(item as GenericPaletteItem)));
desk.beam.on("itemDelete", (id) => ipcSend("beamPaletteDelete", id));
desk.beam.on("itemMove", (id1: number, id2: number) => ipcSend("beamPaletteMove", id1, id2));
desk.beam.on("itemUpdate", (item) => ipcSend("beamPaletteUpdate", GenericPaletteItem.serialize(item as GenericPaletteItem)));

ipcMain.on("beamPaletteRecord", (e, paletteId: number, selectedChannels: Set<number>) => {
	const paletteData = getProfileValuesFromCategory("BEAM", selectedChannels);
	desk.beam.addItem(new GenericPaletteItem(desk.beam.getPaletteData(), paletteId, paletteData));
});

ipcMain.on("beamPaletteDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.beam.removeItem(id) : desk.beam.removeItems(id)));
ipcMain.on("beamPaletteMove", (e, id1: number, id2: number) => desk.beam.moveItem(id1, id2));
ipcMain.on("beamPaletteName", (e, id: number, name: string) => desk.beam.getItem(id).setName(name));

// Shape \\
desk.shape.on("itemAdd", (item) => ipcSend("shapePaletteAdd", GenericPaletteItem.serialize(item as GenericPaletteItem)));
desk.shape.on("itemDelete", (id) => ipcSend("shapePaletteDelete", id));
desk.shape.on("itemMove", (id1: number, id2: number) => ipcSend("shapePaletteMove", id1, id2));
desk.shape.on("itemUpdate", (item) => ipcSend("shapePaletteUpdate", GenericPaletteItem.serialize(item as GenericPaletteItem)));

ipcMain.on("shapePaletteRecord", (e, paletteId: number, selectedChannels: Set<number>) => {
	const paletteData = getProfileValuesFromCategory("SHAPE", selectedChannels);
	desk.shape.addItem(new GenericPaletteItem(desk.shape.getPaletteData(), paletteId, paletteData));
});

ipcMain.on("shapePaletteDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.shape.removeItem(id) : desk.shape.removeItems(id)));
ipcMain.on("shapePaletteMove", (e, id1: number, id2: number) => desk.shape.moveItem(id1, id2));
ipcMain.on("shapePaletteName", (e, id: number, name: string) => desk.shape.getItem(id).setName(name));

// Position \\

desk.position.on("itemAdd", (item) => ipcSend("positionPaletteAdd", GenericPaletteItem.serialize(item as GenericPaletteItem)));
desk.position.on("itemDelete", (id) => ipcSend("positionPaletteDelete", id));
desk.position.on("itemMove", (id1: number, id2: number) => ipcSend("positionPaletteMove", id1, id2));
desk.position.on("itemUpdate", (item) => ipcSend("positionPaletteUpdate", GenericPaletteItem.serialize(item as GenericPaletteItem)));

ipcMain.on("positionPaletteRecord", (e, paletteId: number, selectedChannels: Set<number>) => {
	const paletteData = getProfileValuesFromCategory("POSITION", selectedChannels);
	desk.position.addItem(new GenericPaletteItem(desk.position.getPaletteData(), paletteId, paletteData));
});

ipcMain.on("positionPaletteDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.position.removeItem(id) : desk.position.removeItems(id)));
ipcMain.on("positionPaletteMove", (e, id1: number, id2: number) => desk.position.moveItem(id1, id2));
ipcMain.on("positionPaletteName", (e, id: number, name: string) => desk.position.getItem(id).setName(name));

// Function \\

desk.function.on("itemAdd", (item) => ipcSend("functionPaletteAdd", GenericPaletteItem.serialize(item as GenericPaletteItem)));
desk.function.on("itemDelete", (id) => ipcSend("functionPaletteDelete", id));
desk.function.on("itemMove", (id1: number, id2: number) => ipcSend("functionPaletteMove", id1, id2));
desk.function.on("itemUpdate", (item) => ipcSend("functionPaletteUpdate", GenericPaletteItem.serialize(item as GenericPaletteItem)));

ipcMain.on("functionPaletteRecord", (e, paletteId: number, selectedChannels: Set<number>) => {
	const paletteData = getProfileValuesFromCategory("FUNCTION", selectedChannels);
	desk.function.addItem(new GenericPaletteItem(desk.function.getPaletteData(), paletteId, paletteData));
});

ipcMain.on("functionPaletteDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.function.removeItem(id) : desk.function.removeItems(id)));
ipcMain.on("functionPaletteMove", (e, id1: number, id2: number) => desk.function.moveItem(id1, id2));
ipcMain.on("functionPaletteName", (e, id: number, name: string) => desk.function.getItem(id).setName(name));

// Uncategorised \\

desk.uncategorised.on("itemAdd", (item) => ipcSend("uncategorisedPaletteAdd", GenericPaletteItem.serialize(item as GenericPaletteItem)));
desk.uncategorised.on("itemDelete", (id) => ipcSend("uncategorisedPaletteDelete", id));
desk.uncategorised.on("itemMove", (id1: number, id2: number) => ipcSend("uncategorisedPaletteMove", id1, id2));
desk.uncategorised.on("itemUpdate", (item) => ipcSend("uncategorisedPaletteUpdate", GenericPaletteItem.serialize(item as GenericPaletteItem)));

ipcMain.on("uncategorisedPaletteRecord", (e, paletteId: number, selectedChannels: Set<number>) => {
	const paletteData = getProfileValuesFromCategory("UNCATEGORISED", selectedChannels);
	desk.uncategorised.addItem(new GenericPaletteItem(desk.uncategorised.getPaletteData(), paletteId, paletteData));
});

ipcMain.on("uncategorisedPaletteDelete", (e, id: number | Set<number>) =>
	typeof id == "number" ? desk.uncategorised.removeItem(id) : desk.uncategorised.removeItems(id)
);
ipcMain.on("uncategorisedPaletteMove", (e, id1: number, id2: number) => desk.uncategorised.moveItem(id1, id2));
ipcMain.on("uncategorisedPaletteName", (e, id: number, name: string) => desk.uncategorised.getItem(id).setName(name));

// ---- \\
// Cues \\
// ---- \\

desk.cues.on("itemAdd", (cue: CuePaletteItem) => ipcSend("cueAdd", CuePaletteItem.serialize(cue)));
desk.cues.on("itemDelete", (id: number | Set<number>) => ipcSend("cueDelete", id));
desk.cues.on("itemMove", (id1: number, id2: number) => ipcSend("cueMove", id1, id2));

ipcMain.on("cueAdd", (e, cueId: number, selectedChannels: Set<number>) => {
	const paletteData = getChannelValues(selectedChannels);
	desk.cues.addItem(new CuePaletteItem(desk.cues.getPaletteData(), cueId, paletteData));
});
ipcMain.on("cueDelete", (e, id: number | Set<number>) => (typeof id == "number" ? desk.cues.removeItem(id) : desk.cues.removeItems(id)));
ipcMain.on("cueMove", (e, id1: number, id2: number) => desk.cues.moveItem(id1, id2));

ipcMain.on("getCue", (e, id: number) => (e.returnValue = CuePaletteItem.serialize(desk.cues.getItem(id))));
ipcMain.on("getCues", (e, ids: Set<number>) => {
	const allowedData = new Map();
	desk.cues.getItems(ids).forEach((v, k) => {
		allowedData.set(k, CuePaletteItem.serialize(v));
	});
	e.returnValue = allowedData;
});
ipcMain.on("getAllCues", (e) => {
	const allowedData = new Map();
	desk.cues.getAllItems().forEach((v, k) => {
		allowedData.set(k, CuePaletteItem.serialize(v));
	});
	e.returnValue = allowedData;
});

// --------- \\
// Playbacks \\
// --------- \\

desk.playbacks.on("itemAdd", (item) => ipcSend("playbackCueAdd", StackCue.serialize(item)));
desk.playbacks.on("itemUpdate", () => {
	console.log("emitted");
	ipcSend("playbackItemUpdate");
});

ipcMain.on("playbackAdd", (e, pbId, source: number | Set<number>) => {
	let type: StackCueSourceType;
	let content;
	if (typeof source == "number") {
		type = "cue";
		content = source;
	} else {
		type = "raw";
		content = getChannelValues(source);
	}
	const cue = new StackCue(pbId, "", { type, content });

	const transitions = new Map();
	getTypes().forEach((chType) => {
		transitions.set(chType, { delay: 0, duration: 3000 });
	});
	cue.cueTransitions = transitions;
	desk.playbacks.addCue(cue);
});

ipcMain.on("playbackCueName", (e, id: string, name: string) => {
	desk.playbacks.cues.find((cue) => cue.id == id).setName(name);
});

// ipcMain.on("playbackIntensity", (e, intensity: number) => {
// 	desk.playbacks.setIntensity(intensity);
// });

ipcMain.on("playbackGo", () => {
	desk.playbacks.go();
});

ipcMain.on("playbackStop", () => {
	desk.playbacks.stop();
});

// ipcMain.on("playbackPause", () => {
// 	desk.playbacks.pause();
// });

ipcMain.on("getAllStackCues", (e) => {
	const allowedData: StackCueData[] = [];
	desk.playbacks.cues.forEach((c) => {
		allowedData.push(StackCue.serialize(c));
	});
	e.returnValue = allowedData;
});
