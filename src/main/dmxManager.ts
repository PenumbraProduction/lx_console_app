import { SerialPort } from "serialport";
import { EventEmitter } from "node:events";
import * as DMX from "../DMX";
import * as ofl from "openfixturelibrary";
import { Profile, PatchChannel, DmxAddressRange, FixtureChannel } from "openfixturelibrary/out/types";
import {ChannelGroup} from "../types/Types";
import {Cue} from "../DMX/Cue";

export const events = new EventEmitter();

export type USB_Device = {
	path: string; // path: 'COM9',
	manufacturer: string; // manufacturer: 'FTDI',
	serialNumber: string; // serialNumber: 'AL05O8JJ',
	pnpId: string; // pnpId: 'FTDIBUS\\VID_0403+PID_6001+AL05O8JJA\\0000',
	locationId: string; // locationId: undefined,
	friendlyName?: string; // friendlyName: 'USB Serial Port (COM9)',
	vendorId: string; // vendorId: '0403',
	productId: string; // productId: '6001'
};

export const fixtureLibrary: Profile[] = ofl.fixtureList; // todo ability to live reload this

const patch: PatchChannel[] = [];
const groups: Map<number, ChannelGroup> = new Map();
const cues: Map<number, Cue> = new Map();

export function findInterface(): Promise<USB_Device> {
	return new Promise<USB_Device>((resolve, reject) => {
		SerialPort.list().then((results) => {
			for (let i = 0; i < results.length; i++) {
				const item = results[i];
				if (item.vendorId == "0403" && item.productId == "6001") return resolve(item);
			}
			reject("Failed to identify any valid connected devices");
		});
	});
}

export const universe = new DMX.Universe();

export async function init(portName: string) {
	await universe.init(portName);
}

export async function exit() {
	await universe.close();
}

export function getChannelsWithMode(profile: Profile, channelMode: number): Array<FixtureChannel> {
	const channels: FixtureChannel[] = [];
	profile.channelModes
		.find((cm) => cm.count == channelMode)
		.channels.forEach((ch) => {
			channels.push(profile.channels[ch]);
		});
	return channels;
}

export function getMainChannel(channel: number | PatchChannel) {
	if (typeof channel == "number") channel = patch.find((pc) => pc.channel == channel);

	const profile = findProfileById(channel.profile);

	const channels = getChannelsWithMode(profile, channel.profileSettings.channelMode);
	let ch = channels.find((ch) => ch.type == "INTENSITY");
	if (!ch) ch = channels.find((ch) => ch.type == "GENERIC");
	return ch;
}

export function getMainChannelOffset(channel: number | PatchChannel): number {
	if (typeof channel == "number") channel = patch.find((pc) => pc.channel == channel);

	if (!channel) {
		console.error("No PatchChannel passed in...");
		return -1;
	}

	const profile = findProfileById(channel.profile);

	const channels = getChannelsWithMode(profile, channel.profileSettings.channelMode);
	let ch = channels.findIndex((ch) => ch.type == "INTENSITY");
	if (ch < 0) ch = channels.findIndex((ch) => ch.type == "GENERIC");
	return ch;
}

export function getAbsoluteMainAddress(channel: number | PatchChannel) {
	if (typeof channel == "number") channel = patch.find((pc) => pc.channel == channel);
	const offset = getMainChannelOffset(channel);
	if (offset < 0) return;
	return channel.address.initial + offset;
}

export function updateChannelsSelect(d: {channels: Array<number>, value: number}) {
	const mainChannels = d.channels.map((ch) => getAbsoluteMainAddress(ch));
	universe.updateSelect(mainChannels, d.value);
}

export function getFixtureLibraryBrands(): string[] {
	const brandSet = new Set();
	for (let i = 0; i < ofl.brandList.length; i++) {
		brandSet.add({name: ofl.brandList[i].name, id: ofl.brandList[i].id});
	}
	return Array.from(brandSet) as Array<string>;
}

export function getFixtureLibraryNames(brand?: string): Profile[] {
	if(!brand) return ofl.fixtureList;
	return ofl.fixtureList.filter((f) => f.brand == brand);
}

export function findProfileByName(brand: string, name: string): Profile {
	return fixtureLibrary.find((p: Profile) => p.brand == brand && p.name == name);
}

export function findProfileById(id: string): Profile {
	return fixtureLibrary.find((p: Profile) => p.id == id);
}

export function checkDmxAddressOverlap(r1: DmxAddressRange, r2: DmxAddressRange) {
	return (
		(r1.initial >= r2.initial && r1.initial <= r2.final) ||
		(r1.final >= r2.initial && r1.final <= r2.final) ||
		(r2.initial >= r1.initial && r2.initial <= r1.final) ||
		(r2.final >= r1.initial && r2.final <= r1.final)
	);
}

export function checkPatchCollision(patchChannel: PatchChannel): string | void {
	if (patchChannel.address.initial > patchChannel.address.final)
		return "'initial' DMX address cannot be greater than 'final' DMX address";
	if (patchChannel.address.initial < 1 || patchChannel.address.final > 512) return "Outside valid DMX range";
	// if(patchChannel.address.final - patchChannel.address.initial + 1 < patchChannel.profileSettings.channelMode) return "DMX range cannot be less than channelMode count";

	for (const existingPatchChannel of patch) {
		if (existingPatchChannel.channel == patchChannel.channel) return "Channel already in use";

		if (checkDmxAddressOverlap(existingPatchChannel.address, patchChannel.address)) return "DMX Address Overlap";
	}
}

export function patchFixture(patchChannel: PatchChannel): string | void {
	const check = checkPatchCollision(patchChannel);
	if (check) return check;
	patch.push(patchChannel);
	events.emit("updatePatch");
}

export function patchFixtures(data: PatchChannel[]): string | void {
	for (const patchChannel of data) {
		const check = checkPatchCollision(patchChannel);
		if (check) {
			return check;
		}
	}
	patch.push(...data);
	events.emit("updatePatch");
}

export function unpatchFixtures(data: {channels: Array<number>}) {
	patch.splice(0, patch.length, ...patch.filter((pc) => !data.channels.includes(pc.channel)));
	events.emit("updatePatch");
}

export function getPatchData(): PatchChannel[] {
	return patch.sort((a, b) => a.channel - b.channel);
}


export function renameChannel(channel: number, name: string) {
	const pcI = patch.findIndex((pc) => pc.channel == channel);
	if(pcI < 0) return;
	patch[pcI].name = name;
	events.emit("updatePatch");
}

export function getGroups(): Map<number, ChannelGroup> {
	return groups;
}

export function getGroup(id: number): ChannelGroup | undefined {
	return groups.has(id) ? groups.get(id) : undefined;
}

export function setGroup(channelGroup: ChannelGroup) {
	groups.set(channelGroup.id, channelGroup);
	events.emit("groupsUpdate"); // todo only send updated group
}

export function getCues(): Map<number, Cue> {
	return cues;
}

export function getCue(id: number): Cue | undefined {
	return cues.has(id) ? cues.get(id) : undefined;
}

export function setCue(cue: Cue) {
	cues.set(cue.id, cue);
	events.emit("cuesUpdate");
}
