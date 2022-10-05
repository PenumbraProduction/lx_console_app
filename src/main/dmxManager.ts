import { ipcMain } from "electron";
import {
	Channel,
	CuePaletteItem,
	DefinedProfile,
	Desk,
	DmxAddressRange,
	FixtureChannel,
	FixtureChannelType,
	GroupPaletteItem
} from "lx_console_backend";
import { Universe } from "dmxuniverse";
import { getChannelTypeMappingForward, getChannelTypeMappingBackward } from "./OFLManager";
import { mainWindow } from "./main";

function ipcSend(channel: string, ...args: any[]) {
	mainWindow.webContents.send(channel, ...args);
}

const universe = new Universe();
const desk = new Desk();

export async function init() {
	const port = await Universe.findInterfacePort().catch((e) => console.log(e));
	if (port) await universe.init(port.path);
}

export async function close() {
	await universe.close().catch((e) => console.log(e));
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
		const channel = desk.patch.getChannel(ch.channel.channel);
		channel.setAddress(ch.addressOffset, ch.value, true);
	});
});

ipcMain.on("clearProgrammer", () => {
	desk.patch.clearProgrammerValues();
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

desk.patch.on("addressUpdate", (address, value, channel, type) => {
	universe.update(address, value.programmerVal >= 0 ? value.programmerVal : value.val);
	ipcSend("addressUpdate", address, value, channel.id, type);
});

ipcMain.on("patchAdd", (e, id: number, profile: DefinedProfile, dmxAddressStart: number) =>
	desk.patch.addChannel(id, profile, dmxAddressStart)
);
ipcMain.on("patchDelete", (e, id: number | Set<number>) =>
	typeof id == "number" ? desk.patch.removeChannel(id) : desk.patch.removeChannels(id)
);
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
	if (getChannelTypeMappingForward(type) !== "UNKNOWN") return (e.returnValue = ch.getChannelsMatchType(type));
	const types = getChannelTypeMappingBackward(type) as FixtureChannelType[];
	const returnChannels: FixtureChannel[] = [];
	types.forEach((type) => {
		returnChannels.push(...ch.getChannelsMatchType(type));
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

ipcMain.on("groupAdd", (e, id: number, channels: Set<number>) =>
	desk.groups.addItem(new GroupPaletteItem(desk.groups.getPaletteData(), id, channels))
);
ipcMain.on("groupDelete", (e, id: number | Set<number>) =>
	typeof id == "number" ? desk.groups.removeItem(id) : desk.groups.removeItems(id)
);
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

// ---- \\
// Cues \\
// ---- \\

desk.cues.on("itemAdd", (cue: CuePaletteItem) => ipcSend("cueAdd", cue));
desk.cues.on("itemDelete", (id: number | Set<number>) => ipcSend("cueDelete", id));
desk.cues.on("itemMove", (id1: number, id2: number) => ipcSend("cueMove", id1, id2));

// todo: work out how im going to store cue data and where that data is coming from
// ipcMain.on("cueAdd", (e, cueOptions: CueOptions) =>
// 	desk.cues.addCue(new Cue({ ...cueOptions, channelData: universe.getUniverseBuffer() }))
// );
ipcMain.on("cueDelete", (e, id: number | Set<number>) =>
	typeof id == "number" ? desk.cues.removeItem(id) : desk.cues.removeItems(id)
);
ipcMain.on("cueMove", (e, id1: number, id2: number) => desk.cues.moveItem(id1, id2));
ipcMain.on("getCue", (e, id: number) => (e.returnValue = desk.cues.getItem(id)));
ipcMain.on("getCues", (e, ids: Set<number>) => (e.returnValue = desk.cues.getItems(ids)));
ipcMain.on("getAllCues", (e) => (e.returnValue = desk.cues.getAllItems()));

// --------- \\
// Playbacks \\
// --------- \\
