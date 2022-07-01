import { SerialPort } from "serialport";
import { EventEmitter } from "node:events";
import * as DMX from "../DMX";
import { Profile, PatchChannel, DmxAddressRange } from "../types/DMXTypes";

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

const dimmer: Profile = {
	id: "9d409451-f31d-493b-ba10-36742ad1a9d3",
	brand: "Generic",
	name: "Dimmer",
	channels: [{ name: "Intensity", type: "INTENSITY" }],
	channelModes: [{ count: 1, channels: [0] }]
};

const eqFusSpot: Profile = {
	id: "ftxur-4ebd1622-3063-4c5a-ae0a-9eb866f5f3e4",
	brand: "Equinox",
	name: "Fusion Spot MKII",
	channels: [
		{
			name: "Pan",
			type: "POS-PAN"
		},
		{
			name: "Fine Pan",
			type: "POS-PAN-FINE"
		},
		{
			name: "Tilt",
			type: "POS-TILT"
		},
		{
			name: "Fine Tilt",
			type: "POS-TILT-FINE"
		}
	],
	channelModes: [
		{
			count: 1,
			channels: [0]
		},
		{
			count: 10,
			channels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
		}
	]
};

export const fixtureLibrary: Profile[] = [eqFusSpot, dimmer]; // todo: actually make a file database thingy

const patch: PatchChannel[] = [];

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

export function getFixtureLibraryBrands(): string[] {
	const brandSet = new Set();
	for (let i = 0; i < fixtureLibrary.length; i++) {
		brandSet.add(fixtureLibrary[i].brand);
	}
	return Array.from(brandSet) as Array<string>;
}

export function getFixtureLibraryNames(brand?: string): string[] {
	let fl;
	if (brand) {
		fl = fixtureLibrary.filter((f) => f.brand == brand);
	} else {
		fl = fixtureLibrary;
	}
	const brandSet = new Set();
	for (let i = 0; i < fl.length; i++) {
		brandSet.add(fl[i].name);
	}
	return Array.from(brandSet) as Array<string>;
}

export function findProfileByName(brand: string, name: string): Profile {
	return fixtureLibrary.find((p) => p.brand == brand && p.name == name);
}

export function findProfileById(id: string): Profile {
	return fixtureLibrary.find((p) => p.id == id);
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
