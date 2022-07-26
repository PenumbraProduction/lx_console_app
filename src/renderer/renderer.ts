// import { deserialize } from "typescript-json-serializer";
import { MainAPI } from "../main/preload";
import validatorEscape from "validator/es/lib/escape"; // jquery text() func does this for you
import * as feather from "feather-icons";
import { v4 as GenerateUUID } from "uuid";
import { Save } from "../common/Save";
import { UserPrefs } from "../common/UserPrefs";

import * as is from "../common/util/is";
import * as DMX from "../DMX/util/DMX512";
import { Profile, PatchChannel } from "openfixturelibrary/out/types";
import { ChannelGroup, UniverseData } from "../types/Types";
import {Cue} from "../DMX/Cue";

import "./styles";

// TODO: remove bootstrap requirement
// need to make a modal thingy bob https://www.w3schools.com/howto/howto_css_modals.asp

// JQuery $("") wrapper to output an error if it doesn't find an element
function query(text: string): JQuery<HTMLElement> {
	const result = $(text);
	if (!result.length) {
		console.error(`JQuery search for '${text}' did not find an element.`);
	}
	return result;
}

// #region Expose the variables/functions sent through the preload.ts

type BridgedWindow = Window &
	typeof globalThis & {
		mainAPI: any;
	};

export const api: MainAPI = (window as BridgedWindow).mainAPI.api;

// const defaultSaveLocation = api.defaultSaveLocation();

const prefs: UserPrefs = api.getPrefs();
const save: Save = api.getSave();

let universeBuffer: UniverseData = [];
export let patch: PatchChannel[] = [];
export let groups: Map<number, ChannelGroup> = new Map();
export let cues: Map<number, Cue> = new Map();

const CONTROL_KEYS = {
	CONTROL: "Control",
	SHIFT: "Shift",
	ALT: "Alt"
};
const controlKeys = new Set();

let cmdHistory: Array<Array<string>> = [];
export let tokenParts: Array<string> = [];
export let tokens: Array<string> = [];

let modalIsOpen = false;
$(".modal").on("hidden.bs.modal", () => (modalIsOpen = false));
$(".modal").on("shown.bs.modal", () => (modalIsOpen = true));

let selectedChannels: Array<number> = [];

// load prefs

if (prefs.defaultMaximized) {
	api.ipcSend("maximize");
}

resizeSidebar(prefs.sidebarWidth);

if (api.showFirstUseModal) {
	setTimeout(() => {
		query("#firstUseModal").modal("show");
	}, 500);

	if (api.showWhatsNewModal) {
		query("#firstUseModal").on("hidden.bs.modal", () => {
			query("#whatsNewModal").modal("show");
		});
	}
} else {
	if (api.showWhatsNewModal) {
		query("#whatsNewModal").modal("show");
	}
}

export function toggleSidebar(forceState?: boolean): void {
	if (typeof forceState == "boolean") {
		if (forceState) {
			document.getElementById("sidebar").classList.add("hidden");
			document.getElementById("commandLine").classList.add("sidebar-hidden");
			document.getElementById("commandLineHistory").classList.add("sidebar-hidden");
			query("#sidebar-toggle").html(feather.icons["chevrons-right"].toSvg());
		} else {
			document.getElementById("sidebar").classList.remove("hidden");
			document.getElementById("commandLine").classList.remove("sidebar-hidden");
			document.getElementById("commandLineHistory").classList.remove("sidebar-hidden");
			query("#sidebar-toggle").html(feather.icons["chevrons-left"].toSvg());
		}
	}

	if (document.getElementById("sidebar").classList.contains("hidden")) {
		document.getElementById("sidebar").classList.remove("hidden");
		document.getElementById("commandLine").classList.remove("sidebar-hidden");
		document.getElementById("commandLineHistory").classList.remove("sidebar-hidden");
		query("#sidebar-toggle").html(feather.icons["chevrons-left"].toSvg());
	} else {
		document.getElementById("sidebar").classList.add("hidden");
		document.getElementById("commandLine").classList.add("sidebar-hidden");
		document.getElementById("commandLineHistory").classList.add("sidebar-hidden");
		query("#sidebar-toggle").html(feather.icons["chevrons-right"].toSvg());
	}
}

export function resizeSidebar(width: number): void {
	if (width >= 200 && width <= 600) {
		prefs.sidebarWidth = width;

		if (document.documentElement.style.getPropertyValue("--sidebar-width") != "0px") {
			document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
		}
	}
}

function handleSidebarResizerDrag(event: MouseEvent): void {
	resizeSidebar(event.clientX);
}

const sidebarResizer = document.getElementById("sidebarResizer");
sidebarResizer.addEventListener("mousedown", () => {
	window.addEventListener("mousemove", handleSidebarResizerDrag, false);
	window.addEventListener(
		"mouseup",
		() => {
			window.removeEventListener("mousemove", handleSidebarResizerDrag, false);
		},
		false
	);
});

// export function getSelection() : Selection {
// 	return window.getSelection();
// }

// export function getSelectionText() : string {
// 	return window.getSelection().toString();
// }

// export function setSelectionText(text : string) : void {
// 	const sel = window.getSelection();
// 	const range = sel.getRangeAt(0);
// 	range.deleteContents();
// 	range.insertNode(document.createTextNode(text));
// }

// export function setSelectionHtml(htmlString : string) : void {
// 	const sel = window.getSelection();
// 	const range = sel.getRangeAt(0);
// 	range.deleteContents();
// 	const frag = range.createContextualFragment(htmlString);
// 	range.insertNode(frag);
// }

function generateRawOutputTable() {
	const container = document.createElement("div");
	container.id = "rawOutput";
	container.classList.add("outputs");
	for (let x = 0; x < 512; x++) {
		const box = document.createElement("div");
		const ch = document.createElement("span");
		const val = document.createElement("span");
		box.id = `raw-output-${x + 1}`;
		box.classList.add("channel");
		ch.innerText = (x + 1).toString();
		val.innerText = "--";
		val.id = `raw-output-${x + 1}-value`;
		box.appendChild(ch);
		box.appendChild(val);
		container.appendChild(box);
	}
	$("#rawOutputContainer").empty().append(container);
}
generateRawOutputTable();

export function generateChannelOutputTable() {
	const container = document.createElement("div");
	container.id = "channelOutput";
	container.classList.add("outputs");
	for (let x = 0; x < patch.length; x++) {
		const pc = patch[x];
		const box = document.createElement("div");
		const ch = document.createElement("span");
		const val = document.createElement("span");
		box.id = `channel-output-${pc.channel}`;
		box.classList.add("channel");
		ch.innerText = pc.channel.toString();
		val.innerText = "--";
		val.id = `channel-output-${pc.channel}-value`;
		box.appendChild(ch);
		box.appendChild(val);
		container.appendChild(box);
	}
	$("#channelOutputContainer").empty().append(container);
}
generateChannelOutputTable();

export function outputSelectUpdate() {
	if ((query("#outputTypeSelect").val() as string) == "raw") {
		$("#channelOutputContainer").hide();
		$("#rawOutputContainer").show();
	} else {
		$("#channelOutputContainer").show();
		$("#rawOutputContainer").hide();
	}
}
outputSelectUpdate();

export function updateOutputTable(values: Array<number>) {
	for (let i = 0; i < values.length; i++) query(`#raw-output-${i + 1}-value`).text(values[i] || 0);
}

export function errorPopup(message: string, detail: string) {
	api.ipcSend("errorPopup", message, detail);
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
	query("#fixtureBrandSelect").empty();
	const dflt = document.createElement("option");
	dflt.textContent = "Select Brand";
	dflt.setAttribute("selected", "selected");
	disableElt(dflt);
	query("#fixtureBrandSelect").append(dflt);

	// populate fixture brand options
	const lib = api.ipcSendSync("getFixtureLibraryBrands");
	lib.forEach((brand: { id: string; name: string }) => {
		const elt = document.createElement("option");
		elt.value = brand.id;
		elt.textContent = brand.name;
		query("#fixtureBrandSelect").append(elt);
	});

	query("#fixtureTypeSelect").empty();
	disableElt(query("#fixtureTypeSelect")[0]);

	query("#fixtureChannelModeSelect").empty();
	disableElt(query("#fixtureChannelModeSelect")[0]);

	disableElt(query("#numberOfFixtures")[0]);
	disableElt(query("#startDmxAddress")[0]);
	disableElt(query("#dmxAddressOffset")[0]);
	disableElt(query("#patchSubmit")[0]);

	query("#patchFixturesModal").modal("show");
}

export function setPatchBrand(): void {
	currentPatchInfo.fixtureBrandId = query("#fixtureBrandSelect").val() as string;

	query("#fixtureTypeSelect").empty();
	const dflt = document.createElement("option");
	dflt.textContent = "Select Fixture";
	dflt.setAttribute("selected", "selected");
	disableElt(dflt);
	query("#fixtureTypeSelect").append(dflt);

	// populate fixtureTypeSelect with options that are from the specified brand
	const lib = api.ipcSendSync("getFixtureLibraryNames", currentPatchInfo.fixtureBrandId);
	lib.forEach((p: Profile) => {
		const elt = document.createElement("option");
		elt.value = p.id;
		elt.textContent = p.name;
		query("#fixtureTypeSelect").append(elt);
	});

	enableElt(query("#fixtureTypeSelect")[0]);
}

export function setPatchType(): void {
	currentPatchInfo.fixtureId = query("#fixtureTypeSelect").val() as string;
	currentPatchInfo.fixtureProfile = api.ipcSendSync("findProfileById", currentPatchInfo.fixtureId);
	// todo: the brand is now the ID of the brand, needs changing to be able to handle sending the brand ID instead of the brand Name

	// populate channelModes
	query("#fixtureChannelModeSelect").empty();
	for (let i = 0; i < currentPatchInfo.fixtureProfile.channelModes.length; i++) {
		const mode = currentPatchInfo.fixtureProfile.channelModes[i];
		const elt = document.createElement("option");
		elt.value = i.toString();
		elt.textContent = mode.count.toString();
		if (i == 0) elt.selected = true;
		query("#fixtureChannelModeSelect").append(elt);
	}

	setPatchChannelMode();

	enableElt(query("#fixtureChannelModeSelect")[0]);
}

export function setPatchChannelMode(): void {
	currentPatchInfo.fixtureChannelMode = parseInt(query("#fixtureChannelModeSelect").val() as string);
	query("#dmxAddressOffset").val(
		currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count
	);
	query("#dmxAddressOffset").attr(
		"min",
		currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count
	);
	setPatchDmxOffset(currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count);

	enableElt(query("#numberOfFixtures")[0]);
	setPatchNumber(1);
	enableElt(query("#startDmxAddress")[0]);
	// setPatchDmxInitial(1); // find first open dmx address range with enough space
	enableElt(query("#dmxAddressOffset")[0]);
	enableElt(query("#patchSubmit")[0]);
}

export function setPatchNumber(count?: number): void {
	if (!count) count = parseInt(query("#numberOfFixtures").val() as string);
	currentPatchInfo.number = count;
}

export function setPatchDmxInitial(start?: number): void {
	if (!start) start = parseInt(query("#startDmxAddress").val() as string);
	currentPatchInfo.initialDmx = start;
}

export function setPatchDmxOffset(offset?: number): void {
	if (!offset) offset = parseInt(query("#dmxAddressOffset").val() as string);
	currentPatchInfo.offsetDmx = offset;
}

export function setPatchStartChannel(startChannel?: number): void {
	if (!startChannel) startChannel = parseInt(query("#startChannel").val() as string);
	currentPatchInfo.startChannel = startChannel;
}

export function patchFixtures(): void {
	// missing data
	if (typeof currentPatchInfo.fixtureBrandId == "undefined" || currentPatchInfo.fixtureBrandId == null) {
		query("#patchFixtureModalMessage").text("Missing information 'fixtureBrand'");
		return;
	}
	if (typeof currentPatchInfo.fixtureId == "undefined" || currentPatchInfo.fixtureId == null) {
		query("#patchFixtureModalMessage").text("Missing information 'fixtureName'");
		return;
	}
	if (typeof currentPatchInfo.fixtureProfile == "undefined" || currentPatchInfo.fixtureProfile == null) {
		query("#patchFixtureModalMessage").text("Missing information 'fixtureProfile'");
		return;
	}
	if (typeof currentPatchInfo.fixtureChannelMode == "undefined" || currentPatchInfo.fixtureChannelMode == null) {
		query("#patchFixtureModalMessage").text("Missing information 'fixtureChannelMode'");
		return;
	}
	if (typeof currentPatchInfo.number == "undefined" || currentPatchInfo.number == null) {
		query("#patchFixtureModalMessage").text("Missing information 'number'");
		return;
	}
	if (typeof currentPatchInfo.initialDmx == "undefined" || currentPatchInfo.initialDmx == null) {
		query("#patchFixtureModalMessage").text("Missing information 'initialDmx'");
		return;
	}
	if (typeof currentPatchInfo.offsetDmx == "undefined" || currentPatchInfo.offsetDmx == null) {
		query("#patchFixtureModalMessage").text("Missing information 'offsetDmx'");
		return;
	}
	if (typeof currentPatchInfo.startChannel == "undefined" || currentPatchInfo.startChannel == null) {
		query("#patchFixtureModalMessage").text("Missing information 'startChannel'");
		return;
	}

	// invalid data
	if (currentPatchInfo.offsetDmx < currentPatchInfo.fixtureChannelMode) {
		query("#patchFixtureModalMessage").text(
			"DMX Offset cannot be less than fixtureChannelMode (minimum required channels used)"
		);
		return;
	}

	const patchChannelArray = [];

	for (let i = 0; i < currentPatchInfo.number; i++) {
		const patchChannel: PatchChannel = {
			channel: currentPatchInfo.startChannel + i,
			name: currentPatchInfo.fixtureProfile.name,
			profile: currentPatchInfo.fixtureProfile.id,
			profileSettings: {
				channelMode: currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count
			},
			address: {
				initial: currentPatchInfo.initialDmx + i * currentPatchInfo.offsetDmx,
				final:
					currentPatchInfo.initialDmx +
					i * currentPatchInfo.offsetDmx +
					currentPatchInfo.fixtureProfile.channelModes[currentPatchInfo.fixtureChannelMode].count -
					1
			}
		};
		patchChannelArray.push(patchChannel);
	}

	const message = api.ipcSendSync("patchFixtures", patchChannelArray);
	if (message) {
		console.log(message);
		query("#patchFixtureModalMessage").text(message);
	} else {
		query("#patchFixturesModal").modal("hide");
		// currentPatchInfo = {};
	}
}

export function generateOpenRenameFixtureModalFunc(channel: number) {
	return function () {
		openRenameFixtureModal(channel);
	};
}

export function openRenameFixtureModal(channel: number) {
	query("#fixtureRenameInput").val("");
	query("#renameChannelIdInfo").text(channel);
	query("#renameFixtureModal").modal("show");
}

export function renameFixture() {
	api.ipcSendSync("renameChannel", {
		channel: parseInt(query("#renameChannelIdInfo").text()),
		name: query("#fixtureRenameInput").val()
	});
	query("#renameFixtureModal").modal("hide");
}

export function forceRefreshPatchList(): void {
	patch = api.ipcSendSync("getPatchData");
	refreshPatchList();
}

export function refreshPatchList(): void {
	query("#patchListChannelContents").empty();
	query("#patchListNameContents").empty();
	query("#patchListProfileContents").empty();
	query("#patchListDmxContents").empty();

	patch.forEach((pc: PatchChannel) => {
		// Channel
		const channelSpan = document.createElement("span");
		channelSpan.id = `patchChannel_channel-${pc.channel}`;
		channelSpan.classList.add("patchChannelComponent");
		channelSpan.classList.add("patchChannel_channel");
		channelSpan.textContent = pc.channel.toString();
		query("#patchListChannelContents").append(channelSpan);
		// Name
		const nameSpan = document.createElement("span");
		nameSpan.id = `patchChannel_name-${pc.channel}`;
		nameSpan.classList.add("patchChannelComponent");
		nameSpan.classList.add("patchChannel_name");
		nameSpan.textContent = pc.name;
		nameSpan.onclick = generateOpenRenameFixtureModalFunc(pc.channel);
		query("#patchListNameContents").append(nameSpan);
		// Name
		const profileSpan = document.createElement("span");
		profileSpan.id = `patchChannel_profile-${pc.channel}`;
		profileSpan.classList.add("patchChannelComponent");
		profileSpan.classList.add("patchChannel_profile");
		const profile = api.ipcSendSync("findProfileById", pc.profile) as Profile;
		profileSpan.setAttribute("profileId", pc.profile);
		profileSpan.textContent = profile.name;
		query("#patchListProfileContents").append(profileSpan);
		// DMX Range
		const dmxRangeSpan = document.createElement("span");
		dmxRangeSpan.id = `patchChannel_dmx-${pc.channel}`;
		dmxRangeSpan.classList.add("patchChannelComponent");
		dmxRangeSpan.classList.add("patchChannel_dmx");
		dmxRangeSpan.textContent = `${pc.address.initial} > ${pc.address.final}`;
		query("#patchListDmxContents").append(dmxRangeSpan);
	});

	generateChannelOutputTable();
}

function generateGroupSelectFunction(selection: Array<number>) {
	return function (e: PointerEvent) {
		if (e.shiftKey)
			return setSelectedChannels(Array.from(new Set(selectedChannels.concat(...selection))) as Array<number>);
		setSelectedChannels(selection);
	};
}

export function forceRefreshGroupsList(): void {
	groups = api.ipcSendSync("getGroups");
	refreshGroupsList();
}

export function refreshGroupsList() {
	query("#groupsContainer").empty();
	groups.forEach((group) => {
		const elt = document.createElement("div");
		elt.id = `group_${group.id}_select`;
		elt.classList.add("group");
		elt.onclick = generateGroupSelectFunction(group.channels);
		const groupId = document.createElement("div");
		groupId.id = `group_${group.id}_id`;
		groupId.classList.add("group_id");
		groupId.innerText = group.id.toString();
		const name = document.createElement("div");
		name.id = `group_${group.id}_name`;
		name.classList.add("group_name");
		name.innerText = group.name;

		elt.appendChild(groupId);
		elt.appendChild(name);

		query("#groupsContainer").append(elt);
	});
}

export function showScreen(screenName: string): void {
	document.querySelectorAll(".sidebar-link").forEach((elt) => elt.classList.remove("active"));
	document.querySelectorAll(`[data-links-to="${screenName}"]`).forEach((elt) => elt.classList.add("active"));

	query(".screen").hide();
	const screenElt = query(`#${screenName}.screen`);
	if (screenElt.length) {
		screenElt.show();
		if (screenElt.hasClass("is-cmd-token") && controlKeys.has(CONTROL_KEYS.CONTROL)) {
			pushToken(screenName);
		}
	} else {
		errorPopup(
			"Failed to find screen " + screenName,
			"hmtl elt with id #" +
				screenName +
				" and class .screen was not found by jquery selection and therefore could not be displayed"
		);
		showScreen("Home");
	}

	query("#content").scrollTop(0);
}

showScreen("Home");

export function parseChannelSelection(tkns: Array<string>, alreadySelectedChannels?: Array<number>): Array<number> {
	const selectedChannels = new Set(alreadySelectedChannels);
	let i = 0;

	const handleTokenPart = (): void => {
		if (i >= tkns.length) return console.log("passed token length");
		const token = tkns[i];
		if (is.isNumber(token)) {
			selectedChannels.add(parseInt(token));
			i += 1;
			return handleTokenPart();
		}

		if (token == "-") {
			selectedChannels.delete(parseInt(tkns[i + 1]));
			i += 2;
			return handleTokenPart();
		}

		if (token == "+") {
			selectedChannels.add(parseInt(tkns[i + 1]));
			i += 2;
			return handleTokenPart();
		}

		if (token == ">") {
			if (parseInt(tkns[i + 1]) < parseInt(tkns[i - 1])) {
				for (let j = parseInt(tkns[i + 1]); j <= parseInt(tkns[i - 1]); j++) {
					if (tkns[i - 2] && tkns[i - 2] == "-") selectedChannels.delete(j);
					else selectedChannels.add(j);
				}
			} else {
				for (let j = parseInt(tkns[i - 1]); j <= parseInt(tkns[i + 1]); j++) {
					if (tkns[i - 2] && tkns[i - 2] == "-") selectedChannels.delete(j);
					else selectedChannels.add(j);
				}
			}

			i += 2;
			return handleTokenPart();
		}

		return;
	};
	handleTokenPart();

	return Array.from(selectedChannels) as Array<number>;
}

// todo I feel like these could be in the DMX manager, and use an IPC to setChannels instead of setting DMX

// END todo \\

export function setSelectedChannels(num: Array<number>) {
	selectedChannels = num;

	query(".channel").removeClass("selected");
	for (let i = 0; i < num.length; i++) {
		query(`#channel-output-${num[i]}`).addClass("selected");
	}
}

window.addEventListener("keydown", (e) => {
	if (modalIsOpen) return;

	// ---------------- \\
	// Add control keys \\
	// ---------------- \\

	if (Object.values(CONTROL_KEYS).includes(e.key)) {
		controlKeys.add(e.key);
		return;
	}

	// ----------------------------------------------- \\
	// prevent typing or actions on keyboard shortcuts \\
	// ----------------------------------------------- \\

	if (e.key == "Meta") return;
	if (e.key == "Unidentified") return;

	if (e.key == "r") if (controlKeys.has(CONTROL_KEYS.ALT)) return;
	if (e.key == "d") if (controlKeys.has(CONTROL_KEYS.ALT)) return;
	if (e.key == "h") if (controlKeys.has(CONTROL_KEYS.ALT)) return;

	if (e.key == "i") if (controlKeys.has(CONTROL_KEYS.CONTROL) && controlKeys.has(CONTROL_KEYS.SHIFT)) return;

	if (e.key == "a") if (controlKeys.has(CONTROL_KEYS.CONTROL)) return e.preventDefault(); // prevent ctrl+a selection

	//

	if (e.key == "Enter") {
		pushToken();
		const wasValid = performCommand();
		if (wasValid) pushCommandInfo();
		return;
	}

	if (e.key == "Backspace") {
		if (controlKeys.has(CONTROL_KEYS.CONTROL)) {
			clearCommandLine();
		} else {
			if (tokenParts.length) popTokenPart();
			else popToken();
		}
		return;
	}

	if (e.key == "@") return pushToken("@");
	if (e.key == ">") return pushToken(">");
	if (e.key == "+") return pushToken("+");
	if (e.key == "-") return pushToken("-");

	if (controlKeys.has(CONTROL_KEYS.CONTROL)) {
		if (e.key == "r") return pushToken("Record");
		if (e.key == "d") return setSelectedChannels([]);
		if (e.key == "c") return pushToken("Copy");
		if (e.key == "n") return pushToken("Name");
		if(e.key == "i") return pushToken("Include");
	}

	pushTokenPart(e.key);
});

document.addEventListener("keyup", (e) => {
	if (Object.values(CONTROL_KEYS).includes(e.key)) {
		controlKeys.delete(e.key);
	}
});

function pushTokenPart(part: string) {
	tokenParts.push(part);
	liveCommandUpdate();
}

function popTokenPart() {
	tokenParts.pop();
	liveCommandUpdate();
}

function pushToken(token?: string) {
	if (tokenParts.length) {
		tokens.push(tokenParts.join(""));
		tokenParts = [];
	}
	if (token) tokens.push(token);
	liveCommandUpdate();
}

function popToken() {
	tokens.pop();
	liveCommandUpdate();
}

function performCommand(): boolean {
	if (!tokens.length) return false;

	if (tokens[0] == "Delete") {
		if (tokens[1] == "Patch") {
			if (!is.isNumber(tokens[2])) {
				api.ipcSend("unpatchFixtures", { channels: selectedChannels });
				return true;
			} else {
				const useChannels = parseChannelSelection(tokens.slice(2));
				api.ipcSend("unpatchFixtures", { channels: useChannels });
				return true;
			}
		}
	}

	if (tokens[0] == "Record") {
		if (tokens[1] == "Patch") {
			openPatchFixturesModal();
			return true;
		}
		if (tokens[1] == "Groups") {
			if (!is.isNumber(tokens[2])) return false;
			const groupNo = parseInt(tokens[2]);
			api.ipcSendSync("setGroup", {
				id: groupNo,
				channels: selectedChannels,
				name: `Group ${groupNo.toString()}`
			});
			return true;
		}
		if(tokens[1] == "Cues") {
			if (!is.isNumber(tokens[2])) return false;
			const c = new Cue(parseInt(tokens[2]), `Cue ${tokens[2]}`, universeBuffer);
			api.ipcSendSync("setCue", c);
			return true;
		}
		if(tokens[1] == "Playbacks") {
			if (!is.isNumber(tokens[2])) return false;

			const nextCueNo = api.ipcSendSync("getNextCueNumber");
			const c = new Cue(nextCueNo, `Cue ${nextCueNo}`, universeBuffer);
			api.ipcSendSync("setCue", c);

			if (!is.isNumber(tokens[3])) {
				//
			}
			
		}
	}

	// Select and set intensity

	if (is.isNumber(tokens[0])) {
		setSelectedChannels(parseChannelSelection(tokens));
	} else if ((tokens[0] == "-" && is.isNumber(tokens[1])) || (tokens[0] == "+" && is.isNumber(tokens[1]))) {
		setSelectedChannels(parseChannelSelection(tokens, selectedChannels));
	}

	const atIndex = tokens.indexOf("@");
	if (atIndex >= 0) {
		if (tokens.indexOf("@", atIndex + 1) >= 0) {
			// if double @s
			api.ipcSend("updateChannelsSelect", {
				channels: selectedChannels,
				value: 255
			});
			return true;
		}
		if (is.isNumber(tokens[atIndex + 1]) && DMX.isWithinRange(parseInt(tokens[atIndex + 1]), 0, 100)) {
			api.ipcSend("updateChannelsSelect", {
				channels: selectedChannels,
				value: DMX.PercentToDMX(parseInt(tokens[atIndex + 1]))
			});
			return true;
		}
	}

	return false;
}

function pushCommandInfo() {
	cmdHistory.push(tokens);
	cmdHistory = cmdHistory.slice(-prefs.commandLineHistoryCount);
	tokens = [];
	tokenParts = [];
	updateCommandLine();
	updateCommandHistory();
}

function clearCommandLine() {
	tokens = [];
	tokenParts = [];
	liveCommandUpdate();
}

function liveCommandUpdate() {
	if (tokens[tokens.length - 1] == tokens[tokens.length - 2] && tokens[tokens.length - 1] == "@") {
		const wasValid = performCommand();
		if (wasValid) pushCommandInfo();
	}

	updateCommandLine();
}

function updateCommandLine() {
	query("#commandLineInput").empty();
	query("#commandLineInput").text(tokens.join(" ") + " " + tokenParts.join(""));
}

let commandHistoryShown = false;

export function toggleCommandHistory() {
	if (commandHistoryShown) closeCommandHistory();
	else openCommandHistory();
}

export function closeCommandHistory() {
	commandHistoryShown = false;
	query("#commandLineHistory").hide();
	query("#commandLineHistoryExpander").html(feather.icons["chevrons-up"].toSvg());
}

export function openCommandHistory(): void {
	commandHistoryShown = true;
	query("#commandLineHistory").show();
	query("#commandLineHistoryExpander").html(feather.icons["chevrons-down"].toSvg());
	updateCommandHistory();
}

function updateCommandHistory() {
	query("#commandLineHistory").empty();
	for (const command of cmdHistory) {
		const c = document.createElement("div");
		c.textContent = command.join(" ");
		c.classList.add("historicCommand");
		query("#commandLineHistory").append(c);
	}
}

export function createNotification(title: string, body: string, timeout: number) {
	// TODO: timeout bar across bottom
	// TODO: pause timer on hover
	// TODO: instant close when cross clicked
	// TODO: Custom action when notification body/title pressed

	const id = GenerateUUID();
	const template = `
		<div class="notification-header">
			<div class="notification-title">${validatorEscape(title)}</div>
			<div class="notification-exit">&times;</div>
		</div>
		<div class="notification-body">
			${validatorEscape(body)}
		</div>`;
	const notification = $(`<div class="notification" id="${id}"></div>`);
	notification.html(template);
	notification.hide();
	query("#notificationContainer").append(notification);
	notification.fadeIn("fast");
	setTimeout(() => {
		notification.fadeOut(() => {
			notification.detach();
		});
	}, timeout * 1000);
}

// #region IPC HANDLERS

api.ipcHandle("console.log", (event: any, text: string) => {
	console.log(text);
});

api.ipcHandle("console.error", (event: any, text: string) => {
	console.error(text);
});

api.ipcHandle("prefsShowSideBar", (event: any, value: boolean) => {
	prefs.showSideBar = value;
});

api.ipcHandle("whatsNew", () => {
	query("#whatsNewModal").modal("show");
});

api.ipcHandle("onClose", () => {
	prefs.defaultMaximized = api.ipcSendSync("isWindowMaximized");
	api.savePrefs(prefs);
	// Save all
	api.saveData(save);
});

// DMX stuffs

api.ipcHandle("universeBufferUpdate", (e, d) => {
	universeBuffer = d;
	updateOutputTable(d);
});

api.ipcHandle("updatePatch", (e, d) => {
	patch = d;
	refreshPatchList();
	generateChannelOutputTable();
});

api.ipcHandle("groupsUpdate", (e, d) => {
	groups = d;
	refreshGroupsList();
});

api.ipcHandle("cuesUpdate", (e, d) => {
	cues = d;
	// refreshCuesList();
});

// #endregion

// These prevent ctrl or middle-clicking on <a>'s causing
// a new window to pop up
window.addEventListener("auxclick", (event) => {
	if (event.button === 1) {
		event.preventDefault();
	}
});
window.addEventListener("click", (event) => {
	if (event.ctrlKey) {
		event.preventDefault();
	}
});
