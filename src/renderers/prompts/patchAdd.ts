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

import "../../../css/style.scss";

import { Profile } from "lx_console_backend";
import { PromptIpc } from "../../main/prompts/prompt_preload";

type BridgedWindow = Window &
	typeof globalThis & {
		promptIpc: any;
	};

export const ipc: PromptIpc = (window as BridgedWindow).promptIpc;

const promptId = document.location.hash.replace("#", "");
const options = ipc.ipcSendSync("prompt-get-options:" + promptId);

console.log(options);

openPatchFixturesModal();

export function submitData() {
	ipc.ipcSend("prompt-post-data:" + promptId, { some: "Data" });
}

export function windowInstruction(instruction: string) {
	ipc.ipcSend("prompt-window-control:" + promptId, instruction);
}

export function enableElt(elt: HTMLElement): void {
	elt.removeAttribute("disabled");
	elt.classList.remove("disabled");
}

export function disableElt(elt: HTMLElement): void {
	elt.setAttribute("disabled", "disabled");
	elt.classList.add("disabled");
}

interface CurrentPatchInfo {
	fixtureBrandId?: string;
	fixtureId?: string;
	fixtureProfile?: Profile;
	fixtureChannelMode?: number;
	number?: number;
	initialDmx?: number;
	offsetDmx?: number;
	startChannel?: number;
}

export const currentPatchInfo: CurrentPatchInfo = {};

export function openPatchFixturesModal(): void {
	$("#fixtureBrandSelect").empty();
	const dflt = document.createElement("option");
	dflt.textContent = "Select Brand";
	dflt.setAttribute("selected", "selected");
	disableElt(dflt);
	$("#fixtureBrandSelect").append(dflt);

	// populate fixture brand options
	const lib = ipc.ipcSendSync("getBrandsList");
	lib.forEach((brand: { id: string; name: string }) => {
		const elt = document.createElement("option");
		elt.value = brand.id;
		elt.textContent = brand.name;
		$("#fixtureBrandSelect").append(elt);
	});

	$("#fixtureTypeSelect").empty();
	disableElt($("#fixtureTypeSelect")[0]);

	$("#fixtureChannelModeSelect").empty();
	disableElt($("#fixtureChannelModeSelect")[0]);

	disableElt($("#numberOfFixtures")[0]);
	disableElt($("#startDmxAddress")[0]);
	disableElt($("#dmxAddressOffset")[0]);
	disableElt($("#patchSubmit")[0]);

	$("#patchFixturesModal").modal("show");
}

export function setPatchBrand(): void {
	currentPatchInfo.fixtureBrandId = $("#fixtureBrandSelect").val() as string;

	$("#fixtureTypeSelect").empty();
	const dflt = document.createElement("option");
	dflt.textContent = "Select Fixture";
	dflt.setAttribute("selected", "selected");
	disableElt(dflt);
	$("#fixtureTypeSelect").append(dflt);

	// populate fixtureTypeSelect with options that are from the specified brand
	const lib = ipc.ipcSendSync("getFixturesByBrandId", { brand: currentPatchInfo.fixtureBrandId });
	lib.forEach((p: Profile) => {
		const elt = document.createElement("option");
		elt.value = p.id;
		elt.textContent = p.name;
		$("#fixtureTypeSelect").append(elt);
	});

	enableElt($("#fixtureTypeSelect")[0]);
}

export function setPatchType(): void {
	currentPatchInfo.fixtureId = $("#fixtureTypeSelect").val() as string;
	currentPatchInfo.fixtureProfile = ipc.ipcSendSync("getFixtureById", { id: currentPatchInfo.fixtureId });

	// populate channelModes
	$("#fixtureChannelModeSelect").empty();
	for (let i = 0; i < currentPatchInfo.fixtureProfile.channelModes.length; i++) {
		const mode = currentPatchInfo.fixtureProfile.channelModes[i];
		const elt = document.createElement("option");
		elt.value = i.toString();
		elt.textContent = `${mode.count.toString()} ${mode.name ? mode.name : ""}`;
		if (i == 0) elt.selected = true;
		$("#fixtureChannelModeSelect").append(elt);
	}

	setPatchChannelMode();

	enableElt($("#fixtureChannelModeSelect")[0]);
}

export function setPatchChannelMode(): void {
	currentPatchInfo.fixtureChannelMode = parseInt($("#fixtureChannelModeSelect").val() as string);
	$("#dmxAddressOffset").val(currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count);
	$("#dmxAddressOffset").attr(
		"min",
		currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count
	);
	setPatchDmxOffset(currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count);

	enableElt($("#numberOfFixtures")[0]);
	setPatchNumber(1);
	enableElt($("#startDmxAddress")[0]);
	// setPatchDmxInitial(1); // find first open dmx address range with enough space
	enableElt($("#dmxAddressOffset")[0]);
	enableElt($("#patchSubmit")[0]);
}

export function setPatchNumber(count?: number): void {
	if (!count) count = parseInt($("#numberOfFixtures").val() as string);
	currentPatchInfo.number = count;
}

export function setPatchDmxInitial(start?: number): void {
	if (!start) start = parseInt($("#startDmxAddress").val() as string);
	currentPatchInfo.initialDmx = start;
}

export function setPatchDmxOffset(offset?: number): void {
	if (!offset) offset = parseInt($("#dmxAddressOffset").val() as string);
	currentPatchInfo.offsetDmx = offset;
}

export function setPatchStartChannel(startChannel?: number): void {
	if (!startChannel) startChannel = parseInt($("#startChannel").val() as string);
	currentPatchInfo.startChannel = startChannel;
}

export function patchFixtures(): void {
	// missing data
	if (typeof currentPatchInfo.fixtureBrandId == "undefined" || currentPatchInfo.fixtureBrandId == null) {
		$("#patchFixtureModalMessage").text("Missing information 'fixtureBrand'");
		return;
	}
	if (typeof currentPatchInfo.fixtureId == "undefined" || currentPatchInfo.fixtureId == null) {
		$("#patchFixtureModalMessage").text("Missing information 'fixtureName'");
		return;
	}
	if (typeof currentPatchInfo.fixtureProfile == "undefined" || currentPatchInfo.fixtureProfile == null) {
		$("#patchFixtureModalMessage").text("Missing information 'fixtureProfile'");
		return;
	}
	if (typeof currentPatchInfo.fixtureChannelMode == "undefined" || currentPatchInfo.fixtureChannelMode == null) {
		$("#patchFixtureModalMessage").text("Missing information 'fixtureChannelMode'");
		return;
	}
	if (typeof currentPatchInfo.number == "undefined" || currentPatchInfo.number == null) {
		$("#patchFixtureModalMessage").text("Missing information 'number'");
		return;
	}
	if (typeof currentPatchInfo.initialDmx == "undefined" || currentPatchInfo.initialDmx == null) {
		$("#patchFixtureModalMessage").text("Missing information 'initialDmx'");
		return;
	}
	if (typeof currentPatchInfo.offsetDmx == "undefined" || currentPatchInfo.offsetDmx == null) {
		$("#patchFixtureModalMessage").text("Missing information 'offsetDmx'");
		return;
	}
	if (typeof currentPatchInfo.startChannel == "undefined" || currentPatchInfo.startChannel == null) {
		$("#patchFixtureModalMessage").text("Missing information 'startChannel'");
		return;
	}

	// invalid data
	if (currentPatchInfo.offsetDmx < currentPatchInfo.fixtureChannelMode) {
		$("#patchFixtureModalMessage").text(
			"DMX Offset cannot be less than fixtureChannelMode (minimum required channels used)"
		);
		return;
	}

	const patchChannelArray = [];

	for (let i = 0; i < currentPatchInfo.number; i++) {
		const patchChannel = {
			channel: currentPatchInfo.startChannel + i,
			definedProfile: {
				...currentPatchInfo.fixtureProfile,
				options: {
					channelMode: currentPatchInfo.fixtureChannelMode
				}
			},
			initialAddress: currentPatchInfo.initialDmx + i * currentPatchInfo.offsetDmx
		};

		if (options.usedChannels.includes(patchChannel.channel)) {
			$("#patchFixtureModalMessage").text(`Channel ${patchChannel.channel} already in use`);
			return;
		}

		const final =
			currentPatchInfo.initialDmx +
			i * currentPatchInfo.offsetDmx +
			currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count -
			1;
		for (let j = patchChannel.initialAddress; j <= final; j++) {
			if (options.usedDmxSpace.includes(j)) {
				$("#patchFixtureModalMessage").text(`DMX Address ${j} already in use by previously patched fixture`);
				return;
			}
		}

		patchChannelArray.push(patchChannel);
	}

	ipc.ipcSend("prompt-post-data:" + promptId, patchChannelArray);
}
