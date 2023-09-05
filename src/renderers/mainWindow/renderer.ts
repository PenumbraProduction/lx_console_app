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

import { Event as ElectronRenderEvent } from "electron/renderer";
import { MainAPI } from "../../main/preload";
import { isNumber } from "../../common/util/is";
import { UserPrefs } from "../../common/UserPrefs";
import { Save } from "../../common/Save";
import { ShowData } from "../../common/ShowFile";
import deepEqual from "deep-equal";
import * as feather from "feather-icons";
import { icons as featherIcons } from "feather-icons";
import color from "color";
import {
	ChannelData,
	CuePaletteItemData,
	DefinedProfile,
	DMXToPercent,
	FixtureChannel,
	GenericPaletteItemData,
	GroupData,
	GroupPaletteItem,
	isWithinRange,
	PercentToDMX,
	ProfileTypeIdentifier,
	StackCueData
} from "lx_console_backend";
import { CommandLine, ControlKey, Key, MetaKey, ModifierKey, NumericalKey } from "../../common/CommandLine";
import moment from "moment";

import "../../../css/style.scss";

type BridgedWindow = Window &
	typeof globalThis & {
		mainAPI: any;
	};

// Export the api object (made accessible from the preload) for access from the DOM
export const api: MainAPI = (window as BridgedWindow).mainAPI.api;

export const prefs: UserPrefs = api.ipcSendSync("getPrefs");
export let save: Save = api.ipcSendSync("getSave");

// used to store information about the currently active show
export let currentShow: ShowData = null;

// if an update has occurred since the user last launched the software
if (api.ipcSendSync("getShowWhatsNew")) {
	// Display the new version information
	$("#helpMessage").text("New Update! At least a version change, lets see what happened....");
	// highlight the Help page
	$(".sidebar-item[data-links-to='Help']").addClass("needs-attention");
}

// if this is the first time the user has ever launched the software
if (api.ipcSendSync("getShowFirstUse")) {
	// display the first time help text
	$("#helpMessage").text(
		"Welcome! I noticed it was your first time using this application. This tab will be your first port of call if you ever get stuck or don't understand something."
	);
	// highlight the Help page
	$(".sidebar-item[data-links-to='Help']").addClass("needs-attention");
}

// api.ipcHandle("updateChecking", () => createNotification("Version Manager", "Checking for updates..."));
// api.ipcHandle("updateNotAvailable", () => createNotification("Version Manager", "No new updates"));
// api.ipcHandle("updateAvailable", ({ version, date}) => createNotification("Version Manager", `New Update! version: ${version}, released on ${date}`) );
// api.ipcHandle("updateCancelled", () => createNotification("Version Manager", "Update Cancelled"));
// api.ipcHandle("updateDownloadProgress", (info) => console.log(info));
// api.ipcHandle("updateDownloaded", () => createNotification("Version Manager", "Download complete, please restart to complete changes"));

// Load the most recently opened show file
if (save.shows.length > 0) loadShow(save.shows.sort((a, b) => b.lastModified - a.lastModified)[0].id);
// If no show files exist, create a new show
else newShow();


api.ipcHandle("updateCurrentShow", (e, cs) => {
	currentShow = cs;
	renderSaves();
});

// Display the show files on the main Home page
export function renderSaves() {
	// Update show name in status
	$("#currentShowStatusText").text(currentShow.skeleton.name);
	$("#showContainer").empty();
	if (save?.shows?.length) {
		save.shows
		// sort so most recently used comes first
			.sort((a, b) => b.lastModified - a.lastModified)
			.forEach((sh) => {
				const showContainer = document.createElement("div");
				showContainer.classList.add("show");
				showContainer.setAttribute("hasContextMenu", "");
				showContainer.setAttribute("draggable", "true");
				showContainer.dataset.showId = sh.id;
				showContainer.dataset.showName = sh.name;
				showContainer.dataset.showLastModified = sh.lastModified.toString();

				// add context menu (right click) behaviour
				showContainer.addEventListener("contextmenu", (e) => {
					const { top, left } = getContextPositionFromMousePos(e, $("#showContextMenu").height(), $("#showContextMenu").width());

					$("#showContextMenu-open").off();
					$("#showContextMenu-rename").off();
					$("#showContextMenu-delete").off();

					$("#showContextMenu-open").on("click", () => {
						loadShow(sh.id);
					});
					$("#showContextMenu-rename").on("click", () => {
						renameSpecifiedShow(sh.id);
					});
					$("#showContextMenu-delete").on("click", () => {
						deleteShow(sh.id);
					});

					return $("#showContextMenu")
						.css({
							top,
							left
						})
						.addClass("shown");
				});

				const showName = document.createElement("div");
				showName.classList.add("showName");
				showName.textContent = sh.name;

				const showLastModified = document.createElement("div");
				showLastModified.classList.add("showLastModified");
				showLastModified.textContent = moment(sh.lastModified).fromNow();

				showContainer.appendChild(showName);
				showContainer.appendChild(showLastModified);

				showContainer.addEventListener("dragstart", (e) => {
					e.preventDefault();
					api.ipcSend("startShowFileDrag", sh.id);
				});

				showContainer.addEventListener("dragend", (e) => {
					e.preventDefault();
					api.ipcSend("endShowFileDrag", sh.id);
				});

				// put the currently active show at the beginning of the list
				if (sh.id == currentShow.skeleton.id) {
					showContainer.classList.add("currentShow");
					showLastModified.textContent = "Current Show";
					$("#showContainer").prepend(showContainer);
				} else {
					$("#showContainer").append(showContainer);
				}
			});
	}
}

// Set default settings and prefs

updateAccentColor(prefs.accentBgColor);
$("#settingsAccentBgColor").val(prefs.accentBgColor);
document.getElementById("settingsAccentBgColor").addEventListener("input", () => {
	updateAccentColor($("#settingsAccentBgColor").val() as string);
});

function updateAccentColor(col: string) {
	prefs.accentBgColor = col;
	prefs.accentFgColor = color(col).isDark() ? "#aeaeae" : "#212121";
	$(":root").css("--accent-bg", col);
	$(":root").css("--accent-fg", prefs.accentFgColor);
}

updateMainColor(prefs.mainBgColor);
$("#settingsMainBgColor").val(prefs.mainBgColor);
document.getElementById("settingsMainBgColor").addEventListener("input", () => {
	updateMainColor($("#settingsMainBgColor").val() as string);
});

function updateMainColor(col: string) {
	prefs.mainBgColor = col;
	// determine whether the background colour is light or dark and use a light or dark font colour accordingly
	prefs.mainFgColor = color(col).isDark() ? "#c4c4c4" : "#212121";
	// update css variables
	$(":root").css("--main-bg", col);
	$(":root").css("--main-fg", prefs.mainFgColor);
}

// helper function to add "needs-attention" class to html elements
export function needsAttention(eltId: string) {
	$(`#${eltId}`).addClass("needs-attention");
}

// helper function to remove "needs-attention" class from html elements
export function attentionRead(eltId: string) {
	$(`#${eltId}`).removeClass("needs-attention");
}

// ########## \\
// Show Saves \\
// ########## \\

export function newShow(name?: string) {
	if (!name) {
		name = api.ipcSendSync("createPrompt", { file: "text_input", options: { prompt: "Show Name", placeholder: "MyShow" } });
		if (!name || !name.length) return false;
	}
	api.ipcSend("newShow", name);
}

export function loadShow(id: string) {
	if (currentShow) api.ipcSend("saveShow", currentShow.skeleton);
	api.ipcSend("loadShow", id);
}

export function saveShow() {
	api.ipcSend("saveShow", currentShow.skeleton);
}

export function renameShow(name?: string) {
	if (!name) {
		name = api.ipcSendSync("createPrompt", { file: "text_input", options: { prompt: "Show Name" } });
		if (!name || !name.length) return false;
	}
	api.ipcSend("renameShow", currentShow.skeleton.id, name);
}

export function renameSpecifiedShow(id: string, name?: string) {
	if (!name) {
		name = api.ipcSendSync("createPrompt", { file: "text_input", options: { prompt: "Show Name" } });
		if (!name || !name.length) return false;
	}
	api.ipcSend("renameShow", id, name);
}

export function deleteShow(id: string) {
	api.ipcSend("deleteShow", id);
	if (currentShow.skeleton.id == id) newShow();
}


api.ipcHandle("loadingShow", () => createNotification("Show File", "Loading show..."));
api.ipcHandle("loadingShowFailed", () => createNotification("Show Show File", "Failed to load show"));
api.ipcHandle("loadedShow", (e, showData: ShowData) => {
	currentShow = showData;
	refreshAll();
	createNotification("Show Saves", "Loaded Show");
});

api.ipcHandle("savingShow", () => createNotification("Show File", "Saving show"));
api.ipcHandle("savingShowFailed", () => createNotification("Show File", "Failed to save show"));
api.ipcHandle("savedShow", () => createNotification("Show File", "Saved show"));

api.ipcHandle("saveUpdated", (e, newSave) => (save = newSave));

api.ipcHandle("forceSaveShow", () => saveShow());

api.ipcHandle("renameCurrentShowFailed", () => createNotification("Rename Show Failed", "Failed to update show for unknown reason"));

api.ipcHandle("showDeleteFailed", () => createNotification("Show Deletion Failed", "Failed to delete show for unknown reason"));
api.ipcHandle("showDeleted", () => {
	createNotification("Show File", "Successfully Deleted Show");
	renderSaves();
});

// END Show Saves

// ##### \\
// Clock \\
// ##### \\

/**
 * Convert current time to HH:MM:SS format and update any elements with the "liveClockText" class
 * Self calling function so updates roughly once every second
 */
function showTime() {
	const date = new Date();
	const h = date.getHours(); // 0 - 23
	const m = date.getMinutes(); // 0 - 59
	const s = date.getSeconds(); // 0 - 59

	const hs = h < 10 ? "0" + h : h;
	const ms = m < 10 ? "0" + m : m;
	const ss = s < 10 ? "0" + s : s;

	const time = `${hs}:${ms}:${ss}`;
	$(".liveClockText").text(time);
	setTimeout(showTime, 1000);
}
showTime();

api.ipcHandle("console.log", (e: ElectronRenderEvent, text: string) => console.log(text));
api.ipcHandle("console.error", (e: ElectronRenderEvent, err: Error) => console.error(err));

api.ipcHandle("prefsShowSideBar", (e: ElectronRenderEvent, value: boolean) => (prefs.showSideBar = value));

// before the software shuts down, save the prefs and current show
api.ipcHandle("onClose", () => {
	prefs.defaultMaximized = api.ipcSendSync("isWindowMaximized");
	api.ipcSend("savePrefs", prefs);
	saveShow();
	api.ipcSend("exit");
});

// List of all the categories of channel types
const ATTRIBUTE_CATEGORIES = ["BEAM", "COLOUR", "POSITION", "SHAPE", "FUNCTION", "UNCATEGORISED"];

export function openPatchFixturesPrompt() {
	// get current patch information
	const usedChannels = api.ipcSendSync("getPatchChannelNumbers");
	const usedDmxSpace = api.ipcSendSync("getUsedDmxSpace");
	// generate a new prompt with the patch add type
	const data = api.ipcSendSync("createPrompt", { file: "patch_add", options: { usedChannels: usedChannels, usedDmxSpace: usedDmxSpace }, prefs });
	if (!data) return; // console.log("Prompt returned no data");
	// patch the fixtures returned from the prompt
	data.forEach((fx: { channel: number; definedProfile: DefinedProfile; initialAddress: number }) => {
		api.ipcSend("patchAdd", fx.channel, fx.definedProfile, fx.initialAddress);
	});
}

/**
 * Helper function for creating a function which is attached to a channelName element in the patch list
 * Generates a text input prompt and assigns the return value to the channel name
 */
function generateRenameChannelFunc(channel: number) {
	return () => {
		const currentName = $(`#patchChannel_name-${channel}`).text();
		const name = api.ipcSendSync("createPrompt", { file: "text_input", options: { prompt: `Rename Channel ${channel}`, placeholder: currentName } });
		if (!name || !name.length) return false;
		api.ipcSend("patchChannelRename", channel, name);
		// cli.setTokens(["Name", "Patch", `${channel}`]);
	};
}


export function renderPatchList(patch: Map<number, any>) {
	const patchArr = Array.from(patch.values());
	patchArr.sort((a, b) => a.channel - b.channel);

	$("#patchListChannelContents").empty();
	$("#patchListNameContents").empty();
	$("#patchListProfileContents").empty();
	$("#patchListDmxContents").empty();

	patchArr.forEach((v) => {
		// ID
		const channelSpan = document.createElement("span");
		channelSpan.id = `patchChannel_channel-${v.channel}`;
		channelSpan.classList.add("patchChannelComponent");
		channelSpan.classList.add("patchChannel_channel");
		channelSpan.textContent = v.channel.toString();
		// when the channel number is clicked, enter the move command in to the CLI and run it
		channelSpan.onclick = () => {
			cli.setTokens(["Move", "Patch", `${v.channel}`]);
			cli.exec();
		};
		$("#patchListChannelContents").append(channelSpan);
		// Name
		const nameSpan = document.createElement("span");
		nameSpan.id = `patchChannel_name-${v.channel}`;
		nameSpan.classList.add("patchChannelComponent");
		nameSpan.classList.add("patchChannel_name");
		nameSpan.textContent = v.name;
		nameSpan.onclick = generateRenameChannelFunc(v.channel);
		$("#patchListNameContents").append(nameSpan);
		// Name
		const profileSpan = document.createElement("span");
		profileSpan.id = `patchChannel_profile-${v.channel}`;
		profileSpan.classList.add("patchChannelComponent");
		profileSpan.classList.add("patchChannel_profile");
		profileSpan.setAttribute("profileId", v.profile.id);
		profileSpan.textContent = v.profile.name;
		$("#patchListProfileContents").append(profileSpan);
		// DMX Range
		const dmxRangeSpan = document.createElement("span");
		dmxRangeSpan.id = `patchChannel_dmx-${v.channel}`;
		dmxRangeSpan.classList.add("patchChannelComponent");
		dmxRangeSpan.classList.add("patchChannel_dmx");
		dmxRangeSpan.textContent = `${v.dmxAddressRange.initial} > ${v.dmxAddressRange.final}`;
		$("#patchListDmxContents").append(dmxRangeSpan);
	});
}

/**
 * fetches the entire patch from the backend and 
 */
export function forceRefreshPatchList() {
	const patch = api.ipcSendSync("getAllChannels");
	renderPatchList(patch);
	generateChannelOutputTable(Array.from(patch.keys()));
}

export function renderGroupList(groups: Map<number, GroupPaletteItem>) {
	$("#groupsContainer").empty();

	groups.forEach((group) => {
		const elt = document.createElement("div");
		elt.id = `group_${group.id}_select`;
		elt.classList.add("group");
		elt.dataset.clickAction = "select";
		elt.dataset.selectType = "group";
		elt.dataset.selectData = group.id.toString();
		elt.onclick = () => setSelectedChannels(group.channels);
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

		$("#groupsContainer").append(elt);
	});
	highlightGroups();
}

export function forceRefreshGroupList() {
	const groups = api.ipcSendSync("getAllGroups");
	renderGroupList(groups);
}

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

function generateChannelOutputTable(channels: Array<number>) {
	const container = document.createElement("div");
	container.id = "channelOutput";
	container.classList.add("outputs");
	channels = channels.sort((a, b) => a - b);
	for (let i = 0; i < channels.length; i++) {
		const box = document.createElement("div");
		const ch = document.createElement("span");
		const val = document.createElement("span");
		box.id = `channel-output-${channels[i]}`;
		box.classList.add("channel");
		ch.innerText = channels[i].toString();
		val.innerText = "--";
		val.id = `channel-output-${channels[i]}-value`;
		box.appendChild(ch);
		box.appendChild(val);
		container.appendChild(box);
	}
	$("#channelOutputContainer").empty().append(container);
}
generateChannelOutputTable([]);

export function outputSelectUpdate(type: string) {
	if (type == "raw") {
		$("#channelOutputContainer").hide();
		$("#rawOutputContainer").show();
	} else if (type == "channels") {
		$("#channelOutputContainer").show();
		$("#rawOutputContainer").hide();
	} else {
		errorPopup("Unknown Output Selection Type", `Selection type "${type}" does not correspond to a viewable page`);
	}
}
outputSelectUpdate("channels");

export function attributeSelectUpdate(pageNum: number) {
	if (pageNum == 0) {
		$(".attribute-palettes-container").removeClass("shown");
		$(".attribute-controls-container").addClass("shown");

		$(".attribute-select-palettes-btn").removeClass("selected");
		$(".attribute-select-controls-btn").addClass("selected");
	} else {
		$(".attribute-palettes-container").addClass("shown");
		$(".attribute-controls-container").removeClass("shown");

		$(".attribute-select-palettes-btn").addClass("selected");
		$(".attribute-select-controls-btn").removeClass("selected");
	}
}
attributeSelectUpdate(0);

export function renderOutputTable(address: number, value: { val: number; programmerVal: number }, channel: number, type: string) {
	$(`#raw-output-${address}-value`).text(value.programmerVal >= 0 ? value.programmerVal : value.val);
	if (type == "INTENSITY") {
		$(`#channel-output-${channel}-value`).text(Math.round(DMXToPercent(value.programmerVal >= 0 ? value.programmerVal : value.val)));
	}
}

function updateAttribute(address: number, value: { val: number; programmerVal: number }, channel: number, type: string, userInitiated: boolean) {
	if (userInitiated) return;
	const ch = api.ipcSendSync("getChannel", channel) as ChannelData;
	$(`#${ch.profile.id}_${ch.profile.options.channelMode}_${address - ch.dmxAddressRange.initial}_attribute_range`).val(
		value.programmerVal >= 0 ? value.programmerVal : value.val
	);
	$(`#${ch.profile.id}_${ch.profile.options.channelMode}_${address - ch.dmxAddressRange.initial}_attribute_value`).text(
		(value.programmerVal >= 0 ? value.programmerVal : value.val).toString()
	);
}

function updateSelectedAttributes() {
	selectedChannels.forEach((channel) => {
		const ch = api.ipcSendSync("getChannel", channel) as ChannelData;
		ch.channelMap.forEach((chm) => {
			const out = ch.output[chm.addressOffset];
			$(`#${ch.profile.id}_${ch.profile.options.channelMode}_${chm.addressOffset}_attribute_range`).val(
				out.programmerVal >= 0 ? out.programmerVal : out.val
			);
			$(`#${ch.profile.id}_${ch.profile.options.channelMode}_${chm.addressOffset}_attribute_value`).text(
				(out.programmerVal >= 0 ? out.programmerVal : out.val).toString()
			);
		});
	});
}

type FixtureAttributeMap = Map<string, { channelData: ChannelData; addressChannels: FixtureChannel[] }>;

export function renderAttributeControllers(fixtures: Map<string, FixtureAttributeMap>) {
	ATTRIBUTE_CATEGORIES.forEach((attr) => {
		$(`#${attr.toLowerCase()}ControlsContainer`).empty();
		const fxs = fixtures.get(attr);
		fxs.forEach((v, k) => {
			const profileChannelMode = k.split("_")[1];
			const fixtureContainerElt = document.createElement("div");
			fixtureContainerElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${attr.toLowerCase()}_controller`;
			fixtureContainerElt.classList.add("attribute-controller-container");

			const fixtureNameElt = document.createElement("span");
			fixtureNameElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${attr.toLowerCase()}_controller_name`;
			fixtureNameElt.classList.add("attribute-controller-name");
			fixtureNameElt.textContent = `${v.channelData.profile.name} (${
				v.channelData.profile.channelModes[v.channelData.profile.options.channelMode].count
			})`;
			fixtureContainerElt.appendChild(fixtureNameElt);

			const attributesContainerElt = document.createElement("div");
			attributesContainerElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${attr.toLowerCase()}_attribute_controller_list`;
			attributesContainerElt.classList.add("attribute-controller-list-container");
			fixtureContainerElt.appendChild(attributesContainerElt);

			v.addressChannels.forEach((ac) => {
				const attributeContainerElt = document.createElement("div");
				attributeContainerElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${ac.addressOffset}_attribute_container`;
				attributeContainerElt.classList.add("attribute-controller");
				attributesContainerElt.appendChild(attributeContainerElt);

				const attributeNameElt = document.createElement("span");
				attributeNameElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${ac.addressOffset}_attribute_name`;
				attributeNameElt.classList.add("attributeName");
				attributeNameElt.textContent = ac.name;
				attributeContainerElt.appendChild(attributeNameElt);

				const attributeDescElt = document.createElement("span");
				attributeDescElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${ac.addressOffset}_attribute_description`;
				attributeDescElt.classList.add("attributeDescription");
				attributeDescElt.textContent = `${ac.type} (${ac.addressOffset})`;
				attributeContainerElt.appendChild(attributeDescElt);

				const attributeValElt = document.createElement("span");
				attributeValElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${ac.addressOffset}_attribute_value`;
				attributeValElt.classList.add("attributeVal");
				attributeValElt.textContent = "0";
				attributeContainerElt.appendChild(attributeValElt);

				const attributeSliderElt = document.createElement("input");
				attributeSliderElt.type = "range";
				attributeSliderElt.min = "0";
				attributeSliderElt.max = "255";
				attributeSliderElt.value = "0";
				attributeSliderElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${ac.addressOffset}_attribute_range`;
				attributeSliderElt.classList.add("attributeRangeInput");
				attributeContainerElt.appendChild(attributeSliderElt);
				attributeSliderElt.addEventListener("input", () => {
					attributeSetByProfile(
						{ targetId: v.channelData.profile.id, targetOptions: profileChannelMode },
						ac.addressOffset,
						parseInt(attributeSliderElt.value)
					);
					attributeValElt.textContent = attributeSliderElt.value;
				});

				const attributeBoundsContainerElt = document.createElement("div");
				attributeBoundsContainerElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${ac.addressOffset}_attribute_bound_container`;
				attributeBoundsContainerElt.classList.add("attributeBoundsContainer");
				attributeContainerElt.appendChild(attributeBoundsContainerElt);
				// attributeBoundsContainerElt.addEventListener("change", (e) => console.log("changed option"));

				const attributeBoundsUnset = document.createElement("div");
				attributeBoundsUnset.id = `${v.channelData.profile.id}_${profileChannelMode}_unset_attribute_bound`;
				attributeBoundsUnset.classList.add("attributeBoundsOption");
				attributeBoundsUnset.textContent = "Unset";
				attributeBoundsUnset.onclick = () => {
					api.ipcSend("clearProgrammerAddress", { channel: v.channelData.channel, address: ac.addressOffset });
				};
				attributeBoundsContainerElt.appendChild(attributeBoundsUnset);

				if (!ac.bounds?.length) return;
				ac.bounds.forEach((bound) => {
					const attributeBoundsOption = document.createElement("div");
					attributeBoundsOption.id = `${v.channelData.profile.id}_${profileChannelMode}_${bound.name}_${bound.initial}_attribute_bound`;
					attributeBoundsOption.classList.add("attributeBoundsOption");
					attributeBoundsOption.textContent = `${bound.name} (${bound.initial} > ${bound.final})`;
					attributeBoundsOption.addEventListener("click", () => {
						attributeSetByProfile({ targetId: v.channelData.profile.id, targetOptions: profileChannelMode }, ac.addressOffset, bound.initial);
						attributeValElt.textContent = bound.initial.toString();
						attributeSliderElt.value = bound.initial.toString();
					});
					// attributeBoundsOption.dataset.clickAction = "attributeSet";
					// attributeBoundsOption.dataset.clickTarget = `${v.channelData.profile.id}_${profileChannelMode}`;
					// attributeBoundsOption.dataset.addressValue = bound.initial.toString();
					// attributeBoundsOption.dataset.addressOffset = ac.addressOffset.toString();

					attributeBoundsContainerElt.appendChild(attributeBoundsOption);
				});
			});
			$(`#${attr.toLowerCase()}ControlsContainer`).append(fixtureContainerElt);
		});
	});
}

export function renderAttributePalettes(category: string) {
	const pals = api.ipcSendSync("getAllPalettes", { category }) as GenericPaletteItemData[];

	$(`#${category.toLowerCase()}PalettesContainer`).empty();
	pals.forEach((pal) => {
		const container = document.createElement("div");
		container.id = `${category.toLowerCase()}PaletteItem_${pal.id}`;
		container.classList.add("paletteItem");

		const idElt = document.createElement("div");
		idElt.classList.add("paletteItemId");
		idElt.textContent = pal.id.toString();

		const nameElt = document.createElement("div");
		nameElt.classList.add("paletteItemName");
		nameElt.textContent = pal.name.toString();

		container.appendChild(idElt);
		container.appendChild(nameElt);

		container.onclick = () => {
			pal.addressValues.forEach(({ value, addressOffset }, { id, options: { channelMode } }) => {
				attributeSetByProfile({ targetId: id, targetOptions: channelMode.toString() }, addressOffset, value);
				$(`#${id}_${channelMode}_${addressOffset}_attribute_range`).val(value);
				$(`#${id}_${channelMode}_${addressOffset}_attribute_value`).text(value.toString());
			});
		};

		$(`#${category.toLowerCase()}PalettesContainer`).append(container);
	});
}

function highlightPalettes() {
	const profileIdentifiers = api.ipcSendSync("getProfileIdentifiersFromChannels", selectedChannels) as Array<ProfileTypeIdentifier>;
	$(".paletteItem").removeClass("highlight");
	ATTRIBUTE_CATEGORIES.forEach((category) => {
		const pals = api.ipcSendSync("getAllPalettes", { category }) as GenericPaletteItemData[];
		pals.forEach((pal) => {
			Array.from(pal.addressValues.keys()).forEach((profileIdentifier) => {
				const included = profileIdentifiers.map((pi) => deepEqual(pi, profileIdentifier)).reduce((prev, curr) => prev || curr, false);
				if (included) $(`#${category.toLowerCase()}PaletteItem_${pal.id}`).addClass("highlight");
			});
		});
	});
}

function highlightGroups() {
	const groups = api.ipcSendSync("getAllGroups");
	const selectedChs = Array.from(selectedChannels);
	groups.forEach((g: GroupPaletteItem) => {
		const gChs = Array.from(g.channels);

		if (gChs.length) {
			if (gChs.every((r) => selectedChs.includes(r))) {
				$(`#group_${g.id}_select`).removeClass("partialSelect").addClass("fullSelect");
				return;
			}

			if (selectedChs.some((r) => gChs.includes(r))) {
				$(`#group_${g.id}_select`).addClass("partialSelect").removeClass("fullSelect");
				return;
			}
		}

		$(`#group_${g.id}_select`).removeClass("partialSelect").removeClass("fullSelect");
	});
}

export function renderCues() {
	$("#cuesContainer").empty();
	const cues = api.ipcSendSync("getAllCues") as CuePaletteItemData[];
	cues.forEach((cue) => {
		const container = document.createElement("div");
		container.id = `cue_${cue.id}`;
		container.classList.add("cue");

		const idElt = document.createElement("div");
		idElt.classList.add("cueId");
		idElt.textContent = cue.id.toString();

		const nameElt = document.createElement("div");
		nameElt.classList.add("cueName");
		nameElt.textContent = cue.name;

		container.appendChild(idElt);
		container.appendChild(nameElt);

		container.onclick = () => {
			cue.addressValues.forEach((value, { channel, address }) => {
				attributeSetByChannel(channel, address, value);
				const ch = api.ipcSendSync("getChannel", channel) as ChannelData;
				$(`#${ch.channel}_${ch.profile.options.channelMode}_${address}_attribute_range`).val(value);
				$(`#${ch.channel}_${ch.profile.options.channelMode}_${address}_attribute_value`).text(value.toString());
			});
		};

		$("#cuesContainer").append(container);
	});
}

export function playbackGo(cueId: number) {
	$(".stackCue").removeClass("highlight");
	$(`#stackCue-${cueId}`).addClass("highlight");
}

export function renderPlayback() {
	$("#playbackStack").empty();
	const stackCues = api.ipcSendSync("getAllStackCues") as StackCueData[];
	stackCues.forEach((c) => {
		const stackCueELt = document.createElement("div");
		stackCueELt.classList.add("stackCue");
		stackCueELt.id = `stackCue${c.id}`;

		const stackCueIdElt = document.createElement("div");
		stackCueIdElt.classList.add("stackCueProp");
		stackCueIdElt.classList.add("stackCueId");
		stackCueIdElt.textContent = c.id;
		stackCueELt.appendChild(stackCueIdElt);

		const stackCueNameElt = document.createElement("div");
		stackCueNameElt.classList.add("stackCueProp");
		stackCueNameElt.classList.add("stackCueName");
		c.name ? (stackCueNameElt.textContent = c.name) : (stackCueNameElt.innerHTML = "&nbsp;");
		stackCueNameElt.onclick = () => {
			const name = api.ipcSendSync("createPrompt", { file: "text_input", options: {} });
			if (!name || !name.length) return false;
			api.ipcSend("playbackCueName", c.id, name);
		};
		stackCueELt.appendChild(stackCueNameElt);

		const stackCueTimingsElt = document.createElement("div");
		stackCueTimingsElt.classList.add("stackCueProp");
		stackCueTimingsElt.classList.add("stackCueTimings");
		stackCueELt.appendChild(stackCueTimingsElt);

		const stackCueTimingsButtonElt = document.createElement("div");
		stackCueTimingsButtonElt.classList.add("stackCueTimingsButton");
		stackCueTimingsButtonElt.innerHTML = featherIcons["clock"].toSvg();
		stackCueTimingsElt.appendChild(stackCueTimingsButtonElt);

		stackCueTimingsElt.onclick = () => {
			stackCueTimingsContainerElt.classList.toggle("shown");
		};

		const stackCueTimingsContainerElt = document.createElement("div");
		stackCueTimingsContainerElt.classList.add("stackCueTimingsContainer");
		stackCueTimingsElt.appendChild(stackCueTimingsContainerElt);

		if(c.cueTransitions?.size) { 
			c.cueTransitions.forEach((tr, trName) => {
			const trElt = document.createElement("div");
			trElt.classList.add("stackCueTimingAttr");
			trElt.classList.add("stackCueTimingsIntensity");

			trElt.onclick = (e) => {
				e.stopPropagation();
				//todo: set specific timing
			};

			const trTextElt = document.createElement("span");
			trTextElt.textContent = trName;
			trElt.appendChild(trTextElt);

			const trTimeElt = document.createElement("span");
			trTimeElt.textContent = `D:${tr.delay} F:${tr.duration}`;
			trElt.appendChild(trTimeElt);

			stackCueTimingsContainerElt.appendChild(trElt);
		});
	}

		const stackCueOptionsElt = document.createElement("div");
		stackCueOptionsElt.classList.add("stackCueProp");
		stackCueOptionsElt.classList.add("stackCueOptions");
		stackCueOptionsElt.innerHTML = featherIcons["tool"].toSvg();
		stackCueELt.appendChild(stackCueOptionsElt);

		$("#playbackStack").append(stackCueELt);
	});
}

export function refreshAll() {
	forceRefreshPatchList();
	ATTRIBUTE_CATEGORIES.forEach((attr) => renderAttributePalettes(attr));
	forceRefreshGroupList();
	renderCues();
	renderPlayback();
	renderSaves();

	setSelectedChannels(new Set());

	// todo: update show specific settings in html
	// todo: update clock and timer in html
}

// --- \\
// DMX \\
// --- \\

export let selectedChannels = new Set<number>();

export function setSelectedChannels(sc: Set<number>) {
	const existingChannels = api.ipcSendSync("getPatchChannelNumbers");
	selectedChannels = new Set(Array.from(sc).filter((num) => existingChannels.includes(num)));

	$(".channel").removeClass("selected");
	selectedChannels.forEach((ch) => $(`#channel-output-${ch}`).addClass("selected"));

	//            ---           \\
	// update attribute options \\
	//            ---           \\

	const attributes = new Map();
	ATTRIBUTE_CATEGORIES.forEach((type) => {
		const attr = new Map();
		selectedChannels.forEach((ch) => {
			const addressChannels = api.ipcSendSync("getChannelsMatchType", ch, type);
			if (!addressChannels.length) return;
			const chData = api.ipcSendSync("getChannel", ch);
			const profileId = chData.profile.id;
			const profileChannelMode = chData.profile.options.channelMode;
			if (!attr.has(`${profileId}_${profileChannelMode}`)) attr.set(`${profileId}_${profileChannelMode}`, { channelData: chData, addressChannels });
		});
		attributes.set(type, attr);
	});

	renderAttributeControllers(attributes);
	updateSelectedAttributes();
	highlightPalettes();
	highlightGroups();
}

const notificationContainer = $("#notificationContainer");
let idCount = 0;
export function createNotification(title: string, message: string, timeSec?: number, callback?: () => void) {
	const id = idCount.toString();
	notificationContainer.append(`
		<div class="notification" id="notification-${id}">
			<div class="notification-header">
				<span>${title}</span>
				<div class="notification-actions-container">
					<span class="notification-action" id="notification-wait-${id}">${featherIcons["paperclip"].toSvg()}</span>
					<span class="notification-action" id="notification-close-${id}">${featherIcons["x-circle"].toSvg()}</span>
				</div>
			</div>
			<div class="notification-body" id="notificationBody-${id}">
				${message}
			</div>
		</div>
	`);

	let counter = timeSec | 20;
	const interval = setInterval(() => {
		counter--;
		if (counter <= 0) {
			$(`#notification-${id}`).remove();
			clearInterval(interval);
		}
	}, 1000);

	$(`#notification-close-${id}`).on("click", (e) => {
		$(`#notification-${id}`).remove();
		clearInterval(interval);
		e.stopPropagation();
	});

	$(`#notification-wait-${id}`).on("click", (e) => {
		e.stopPropagation();
		clearInterval(interval);
		$(`#notification-wait-${id}`).remove();
	});

	if (callback) $(`#notification-${id}`).on("click", callback);

	idCount++;
}

api.ipcHandle("updatingFixtureLibrary", () => {
	createNotification("Profile Library", "Updating profile library...");
	$("#profileLibraryStatus").addClass("needs-attention");
	$("#profileLibraryStatus>.statusbar-item-content>.feather-container").html(featherIcons["loader"].toSvg());
});
api.ipcHandle("updatingFixtureLibraryEnd", () => {
	createNotification("Profile Library", "Profile library updated!");
	$("#profileLibraryStatus").removeClass("needs-attention");
	$("#profileLibraryStatus>.statusbar-item-content>.feather-container").html(featherIcons["pocket"].toSvg());
});

api.ipcHandle("uploadingCustomProfile", () => {
	createNotification("Custom Profile", "Uploading...");
	$("#profileLibraryStatus").addClass("needs-attention");
	$("#profileLibraryStatus>.statusbar-item-content>.feather-container").html(featherIcons["loader"].toSvg());
});
api.ipcHandle("uploadingCustomProfile", () => {
	createNotification("Custom Profile", "Upload Complete!");
	$("#profileLibraryStatus").removeClass("needs-attention");
	$("#profileLibraryStatus>.statusbar-item-content>.feather-container").html(featherIcons["pocket"].toSvg());
});

api.ipcHandle("serialportOpen", () => {
	createNotification("DMX Interface", "Interface Connected!");
	$("#dmxInterfaceStatus").removeClass("needs-attention");
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["upload"].toSvg());
});

api.ipcHandle("serialportOpening", () => {
	// createNotification("DMX Interface", "Connecting...");
	// console.log("Serialport opening");
	$("#dmxInterfaceStatus").removeClass("needs-attention");
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["loader"].toSvg());
});

api.ipcHandle("serialportOpeningFailed", () => {
	createNotification("DMX Interface", "Failed to connect to interface");
	$("#dmxInterfaceStatus").addClass("needs-attention");
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["alert-triangle"].toSvg());
});

api.ipcHandle("serialportClose", () => {
	createNotification("DMX Interface", "Interface Disconnected");
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["disc"].toSvg());
	$("#dmxInterfaceStatus").removeClass("needs-attention");
});

api.ipcHandle("serialportError", (e, err) => {
	createNotification("DMX Interface", err.toString ? err.toString() : err);
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["alert-triangle"].toSvg());
	$("#dmxInterfaceStatus").addClass("needs-attention");
});

api.ipcHandle("serialportRetry", () => {
	// console.log("Serialport Retry");
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["loader"].toSvg());
	$("#dmxInterfaceStatus").removeClass("needs-attention");
});

api.ipcHandle("serialportRetryFail", (e, err) => {
	createNotification("DMX Interface", `Failed to connect: ${err}`);
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["disc"].toSvg());
	$("#dmxInterfaceStatus").removeClass("needs-attention");
});

// api.ipcHandle("bufferUpdate", (e, data) => renderRawOutputTable(data));
api.ipcHandle("addressUpdate", (e, address, value, channel, type, userInitiated) => {
	renderOutputTable(address, value, channel, type);
	updateAttribute(address, value, channel, type, userInitiated);
});

api.ipcHandle("patchAdd", () => forceRefreshPatchList());
api.ipcHandle("patchDelete", () => forceRefreshPatchList());
api.ipcHandle("patchMove", () => forceRefreshPatchList());
api.ipcHandle("channelNameUpdate", () => forceRefreshPatchList());

api.ipcHandle("groupAdd", () => forceRefreshGroupList());
api.ipcHandle("groupDelete", () => forceRefreshGroupList());
api.ipcHandle("groupMove", () => forceRefreshGroupList());
api.ipcHandle("groupUpdate", () => forceRefreshGroupList());

api.ipcHandle("colourPaletteAdd", () => renderAttributePalettes("COLOUR"));
api.ipcHandle("colourPaletteDelete", () => renderAttributePalettes("COLOUR"));
api.ipcHandle("colourPaletteMove", () => renderAttributePalettes("COLOUR"));
api.ipcHandle("colourPaletteUpdate", () => renderAttributePalettes("COLOUR"));

api.ipcHandle("positionPaletteAdd", () => renderAttributePalettes("POSITION"));
api.ipcHandle("positionPaletteDelete", () => renderAttributePalettes("POSITION"));
api.ipcHandle("positionPaletteMove", () => renderAttributePalettes("POSITION"));
api.ipcHandle("positionPaletteUpdate", () => renderAttributePalettes("POSITION"));

api.ipcHandle("beamPaletteAdd", () => renderAttributePalettes("BEAM"));
api.ipcHandle("beamPaletteDelete", () => renderAttributePalettes("BEAM"));
api.ipcHandle("beamPaletteMove", () => renderAttributePalettes("BEAM"));
api.ipcHandle("beamPaletteUpdate", () => renderAttributePalettes("BEAM"));

api.ipcHandle("shapePaletteAdd", () => renderAttributePalettes("SHAPE"));
api.ipcHandle("shapePaletteDelete", () => renderAttributePalettes("SHAPE"));
api.ipcHandle("shapePaletteMove", () => renderAttributePalettes("SHAPE"));
api.ipcHandle("shapePaletteUpdate", () => renderAttributePalettes("SHAPE"));

api.ipcHandle("functionPaletteAdd", () => renderAttributePalettes("FUNCTION"));
api.ipcHandle("functionPaletteDelete", () => renderAttributePalettes("FUNCTION"));
api.ipcHandle("functionPaletteMove", () => renderAttributePalettes("FUNCTION"));
api.ipcHandle("functionPaletteUpdate", () => renderAttributePalettes("FUNCTION"));

api.ipcHandle("uncategorisedPaletteAdd", () => renderAttributePalettes("UNCATEGORISED"));
api.ipcHandle("uncategorisedPaletteDelete", () => renderAttributePalettes("UNCATEGORISED"));
api.ipcHandle("uncategorisedPaletteMove", () => renderAttributePalettes("UNCATEGORISED"));
api.ipcHandle("uncategorisedPaletteUpdate", () => renderAttributePalettes("UNCATEGORISED"));

api.ipcHandle("cueAdd", () => renderCues());
api.ipcHandle("cueDelete", () => renderCues());
api.ipcHandle("cueMove", () => renderCues());

api.ipcHandle("playbackGo", (e, cueId) => playbackGo(cueId));
api.ipcHandle("playbackCueAdd", () => renderPlayback());
api.ipcHandle("playbackItemUpdate", () => renderPlayback());

api.ipcHandle("refreshAll", () => refreshAll());

function attributeSetByProfile(target: string | { targetId: string; targetOptions: string }, addressOffset: number, addressValue: number) {
	if (typeof target == "string") {
		const [targetId, targetOptions] = target.split("_");
		target = { targetId, targetOptions };
	}
	const channels: Map<number, ChannelData> = api.ipcSendSync("getChannelsByProfileType", target.targetId, {
		channelMode: parseInt(target.targetOptions)
	});
	channels.forEach((ch) => {
		if (!selectedChannels.has(ch.channel)) channels.delete(ch.channel);
	});
	const chs = Array.from(channels.values()).map((ch) => ({
		channel: ch.channel,
		addressOffset: addressOffset,
		value: addressValue
	}));
	api.ipcSend("updateChannelsAttribute", { channels: chs });
}

function attributeSetByChannel(channel: number, addressOffset: number, addressValue: number) {
	api.ipcSend("updateChannelsAttribute", {
		channels: [
			{
				channel: channel,
				addressOffset: addressOffset,
				value: addressValue
			}
		]
	});
}

export function parseSelectionString(tokens: string[], modifyFrom?: Set<number>): Set<number> {
	const channels = modifyFrom ? modifyFrom : new Set<number>();
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (isNumber(token)) channels.add(parseInt(token));
		else if (token == "-") {
			if (isNumber(tokens[i + 1])) {
				channels.delete(parseInt(tokens[i + 1]));
				i++;
			}
		} else if (token == "+") {
			if (isNumber(tokens[i + 1])) {
				channels.add(parseInt(tokens[i + 1]));
				i++;
			}
		} else if (token == ">") {
			let next = parseInt(tokens[i + 1]);
			let prev = parseInt(tokens[i - 1]);
			if (next < prev) {
				const t = next;
				next = prev;
				prev = t;
			}
			for (let j = prev; j <= next; j++) {
				if (tokens[i - 2] && tokens[i - 2] == "-") channels.delete(j);
				else channels.add(j);
			}

			i++;
		} else if (token == "Groups") {
			if (!isNumber(tokens[i + 1])) break;
			const group = api.ipcSendSync("getGroup", parseInt(tokens[i + 1])) as GroupData;
			if (tokens[i - 1] && tokens[i - 1] == "-") {
				group.channels.forEach((ch) => channels.delete(ch));
			} else if (tokens[i - 1] && tokens[i - 1] == "+") {
				group.channels.forEach((ch) => channels.add(ch));
			} else {
				channels.clear();
				group.channels.forEach((ch) => channels.add(ch));
			}
			i++;
		} else {
			break;
		}
	}

	return channels;
}

// ------------ \\
// Command Line \\
// ------------ \\

const cli = new CommandLine({ contentHistoryOptions: { maxLength: prefs.commandLineHistoryCount } });

cli.on("tokenUpdate", () => {
	$("#commandLineInput").empty();
	$("#commandLineInput").text(cli.tokens.join(" ") + " " + cli.tokenParts.join(""));
});

cli.on("historyUpdate", () => {
	$("#commandLineHistory").empty();
	for (const command of cli.history.list()) {
		const c = document.createElement("div");
		c.textContent = command.join(" ");
		c.classList.add("historicCommand");
		$("#commandLineHistory").append(c);
	}
});

export function toggleCommandHistory() {
	$("#commandLineHistory").toggle();
}

cli.setExecFunc((tokens: string[]) => {
	if (!tokens.length) return false;

	function setIntensity() {
		const atIndex = tokens.indexOf("@");
		if (atIndex >= 0) {
			if (tokens.indexOf("@", atIndex + 1) >= 0) {
				// if double @s
				api.ipcSend("updateChannelsIntensity", {
					channels: selectedChannels,
					value: 255
				});
				return true;
			}
			if (isNumber(tokens[atIndex + 1]) && isWithinRange(parseInt(tokens[atIndex + 1]), 0, 100)) {
				api.ipcSend("updateChannelsIntensity", {
					channels: selectedChannels,
					value: PercentToDMX(parseInt(tokens[atIndex + 1]))
				});
				return true;
			}
		}
	}

	if (isNumber(tokens[0])) {
		setSelectedChannels(parseSelectionString(tokens));
		setIntensity();
		return true;
	} else if (tokens[0] == "-" || tokens[0] == "+" || tokens[0] == "Groups") {
		if (tokens[1] == "-" || tokens[1] == "+") {
			// todo: increment, decrement intensity
		}
		setSelectedChannels(parseSelectionString(tokens, selectedChannels));
		return true;
	}

	if (setIntensity()) return true;

	if (tokens[0] == "Go") {
		if (isNumber(tokens[1])) {
			console.log("TODO: Goto specified Cue ID");
		}
		api.ipcSend("playbackGo");
		return true;
	}

	if (tokens[0] == "Time") {
		if (ATTRIBUTE_CATEGORIES.includes(tokens[1].toUpperCase())) {
			const timings = api.ipcSendSync("createPrompt", { file: "transition_timings", options: {} });
			console.log(timings);
			if (!timings) return false;
			return true;
		}
	}

	if (tokens[0] == "Name") {
		if (tokens[1] == "Patch") {
			if (isNumber(tokens[2])) {
				const name = api.ipcSendSync("createPrompt", { file: "text_input", options: {} });
				if (!name || !name.length) return false;
				api.ipcSend("patchChannelRename", parseInt(tokens[2]), name);
				return true;
			}
		}

		if (ATTRIBUTE_CATEGORIES.includes(tokens[1].toUpperCase())) {
			if (!isNumber(tokens[2])) return false;
			const name = api.ipcSendSync("createPrompt", { file: "text_input", options: {} });
			if (!name || !name.length) return false;
			api.ipcSend(`${tokens[1].toLowerCase()}PaletteName`, parseInt(tokens[2]), name);
			return true;
		}

		if (tokens[1] == "Groups") {
			if (!isNumber(tokens[2])) return false;
			const name = api.ipcSendSync("createPrompt", { file: "text_input", options: {} });
			if (!name || !name.length) return false;
			const groupId = parseInt(tokens[2]);
			api.ipcSend("groupName", groupId, name);
			return true;
		}

		if (tokens[1] == "Cues") {
			if (!isNumber(tokens[2])) return false;
			const name = api.ipcSendSync("createPrompt", { file: "text_input", options: {} });
			if (!name || !name.length) return false;
			const cueId = parseInt(tokens[2]);
			api.ipcSend("cueName", cueId, name);
			return true;
		}

		if (tokens[1] == "Playbacks") {
			if (!isNumber(tokens[2])) return false;
			const name = api.ipcSendSync("createPrompt", { file: "text_input", options: {} });
			if (!name || !name.length) return false;
			const cueId = parseInt(tokens[2]);
			api.ipcSend("playbackCueName", cueId, name);
			return true;
		}
	}

	if (tokens[0] == "Move") {
		if (tokens[1] == "Patch") {
			if (isNumber(tokens[2])) {
				if (isNumber(tokens[3])) {
					api.ipcSend("patchMove", parseInt(tokens[2]), parseInt(tokens[3]));
					return true;
				}
			}
		}

		if (ATTRIBUTE_CATEGORIES.includes(tokens[1].toUpperCase())) {
			if (!isNumber(tokens[2]) || !isNumber(tokens[3])) return false;
			const ogID = parseInt(tokens[2]);
			const newID = parseInt(tokens[3]);
			api.ipcSend(`${tokens[1].toLowerCase()}PaletteMove`, ogID, newID);
			return true;
		}

		if (tokens[1] == "Cues") {
			if (!isNumber(tokens[2]) || !isNumber(tokens[3])) return false;
			const ogID = parseInt(tokens[2]);
			const newID = parseInt(tokens[3]);
			api.ipcSend("cueMove", ogID, newID);
			return true;
		}
	}

	if (tokens[0] == "Delete") {
		if (tokens[1] == "Delete") {
			// clear programmer values
			api.ipcSend("clearProgrammer");
			return true;
		}
		if (tokens[1] == "Patch") {
			if (isNumber(tokens[2])) {
				api.ipcSend("patchDelete", parseSelectionString(tokens.slice(2)));
				return true;
			} else {
				api.ipcSend("patchDelete", selectedChannels);
				return true;
			}
		}
		if (ATTRIBUTE_CATEGORIES.includes(tokens[1].toUpperCase())) {
			if (!isNumber(tokens[2])) return false;
			const paletteId = parseInt(tokens[2]);
			api.ipcSend(`${tokens[1].toLowerCase()}PaletteDelete`, paletteId);
			return true;
		}
		if (tokens[1] == "Groups") {
			if (!isNumber(tokens[2])) return false;
			const groupId = parseInt(tokens[2]);
			api.ipcSend("groupDelete", groupId);
			return true;
		}
		if (tokens[1] == "Cues") {
			if (!isNumber(tokens[2])) return false;
			const cueId = parseInt(tokens[2]);
			api.ipcSend("cueDelete", cueId);
			return true;
		}
	}

	if (tokens[0] == "Record") {
		if (tokens[1] == "Patch") {
			openPatchFixturesPrompt();
			return true;
		}
		if (ATTRIBUTE_CATEGORIES.includes(tokens[1].toUpperCase())) {
			if (!isNumber(tokens[2])) return false;
			const paletteId = parseInt(tokens[2]);
			api.ipcSend(`${tokens[1].toLowerCase()}PaletteRecord`, paletteId, selectedChannels);
			return true;
		}
		if (tokens[1] == "Groups") {
			if (!isNumber(tokens[2])) return false;
			const paletteId = parseInt(tokens[2]);
			api.ipcSend("groupAdd", paletteId, selectedChannels);
			return true;
		}
		if (tokens[1] == "Cues") {
			if (!isNumber(tokens[2])) return false;
			const cueId = parseInt(tokens[2]);
			api.ipcSend("cueAdd", cueId, selectedChannels);
			return true;
		}
		if (tokens[1] == "Playbacks") {
			if (!isNumber(tokens[2])) return false;
			const pbCueId = parseInt(tokens[2]);
			let source: number | Set<number> = selectedChannels;
			if (tokens[3] == "Cues" && isNumber(tokens[4])) {
				source = parseInt(tokens[4]);
			}
			api.ipcSend("playbackAdd", pbCueId, source);
			return true;
		}
	}

	return false;
});

const modifierKeys = new Set();

window.addEventListener("keydown", (e: KeyboardEvent) => {
	const key_l = e.key.toLowerCase();
	if (Object.values(MetaKey).includes(e.key)) return;
	if (Object.values(ModifierKey).includes(e.key)) return modifierKeys.add(e.key);

	if (e.key == Key.META) return;
	if (e.key == Key.UNIDENTIFIED) return;

	// ----------------------------------------------- \\
	// prevent typing or actions on keyboard shortcuts \\
	// ----------------------------------------------- \\

	if (key_l == "r") if (modifierKeys.has(ModifierKey.ALT)) return;
	if (key_l == "r") if (modifierKeys.has(ModifierKey.CONTROL)) return;
	if (key_l == "d") if (modifierKeys.has(ModifierKey.ALT)) return;
	if (key_l == "h") if (modifierKeys.has(ModifierKey.ALT)) return;
	if (key_l == "i") if (modifierKeys.has(ModifierKey.CONTROL) && modifierKeys.has(ModifierKey.SHIFT)) return;
	if (key_l == "a") if (modifierKeys.has(ModifierKey.CONTROL)) return e.preventDefault(); // prevent ctrl+a selection

	// ------------- \\
	// Custom tokens \\
	// ------------- \\

	if (e.key == Key.ENTER) return cli.exec();

	if (e.key == Key.BACKSPACE) {
		if (modifierKeys.has(ModifierKey.CONTROL)) cli.clear();
		else cli.backspace();
		return;
	}
	if (e.key == ControlKey.DELETE) return cli.addToken("Delete");

	if (modifierKeys.has(ModifierKey.CONTROL)) {
		if (key_l == "p") return cli.addToken("Position");
		if (key_l == "c") return cli.addToken("Colour");
		if (key_l == "s") return cli.addToken("Shape");
		if (key_l == "b") return cli.addToken("Beam");
		if (key_l == "f") return cli.addToken("Function");
		if (key_l == "u") return cli.addToken("Uncategorised");
		if (key_l == "g") return cli.addToken("Go");

		if (key_l == "x") return cli.addToken("Cues");
		if (key_l == "k") return cli.addToken("Playbacks");

		if (key_l == "l") return api.ipcSend("lock");
	}

	if (key_l == "@") return cli.addToken("@");
	if (key_l == ">") return cli.addToken(">");
	if (key_l == "/") return cli.addToken(">");
	if (key_l == "+") return cli.addToken("+");
	if (key_l == "-") return cli.addToken("-");

	if (key_l == "d") return setSelectedChannels(new Set());
	if (key_l == "a") return cli.addToken("Add");
	if (key_l == "t") return cli.addToken("Time");
	if (key_l == "p") return cli.addToken("Patch");
	if (key_l == "r") return cli.addToken("Record");
	if (key_l == "u") return cli.addToken("Update");
	if (key_l == "c") return cli.addToken("Copy");
	if (key_l == "n") return cli.addToken("Name");
	if (key_l == "i") return cli.addToken("Include");
	if (key_l == "m") return cli.addToken("Move");
	if (key_l == "g") return cli.addToken("Groups");

	if (e.key == ControlKey.SPACE) cli.addToken();
	if (Object.values(NumericalKey).includes(e.key)) cli.addTokenPart(e.key);
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
	if (Object.values(ModifierKey).includes(e.key)) return modifierKeys.delete(e.key);
});

window.addEventListener("mousedown", (e) => {
	if (e.button != 0) return; // todo: allow right clicking for context menus (button 2)
	const path = e.composedPath();

	path.filter((elt) => elt instanceof HTMLElement).forEach((elt: HTMLElement) => {
		switch (elt.dataset.clickAction) {
			case "page": {
				if (elt.dataset.cmdToken && modifierKeys.has(ModifierKey.CONTROL)) cli.addToken(elt.dataset.cmdToken);
				showScreen(elt.dataset.linksTo);
				break;
			}
			case "select": {
				// e.g selecting a group or playback
				switch (elt.dataset.selectType) {
					case "group": {
						cli.optionalAddToken("Groups");
						cli.addToken(`${elt.dataset.selectData}`);
						break;
					}
				}
				// ! is a select action always the last thing in a CLI command? I assume so and run the CLI enter action automatically
				cli.exec();
				break;
			}
			case "attributeSet": {
				attributeSetByProfile(elt.dataset.clickTarget, parseInt(elt.dataset.addressOffset), parseInt(elt.dataset.addressValue));
				break;
			}
			default:
				break; // No action;
		}
	});
});

// ------- \\
// DISPLAY \\
// ------- \\

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

export function showScreen(screenName: string): void {
	document.querySelectorAll(".sidebar-link").forEach((elt) => elt.classList.remove("active"));
	document.querySelectorAll(`[data-links-to="${screenName}"]`).forEach((elt) => {
		elt.classList.add("active");
		elt.classList.remove("needs-attention");
	});

	$(".screen").hide();
	const screenElt = $(`#${screenName}.screen`);
	if (screenElt.length) {
		screenElt.show();
	} else {
		errorPopup(
			"Failed to find screen " + screenName,
			"hmtl elt with id #" + screenName + " and class .screen was not found by jquery selection and therefore could not be displayed"
		);
		showScreen("Home");
	}

	$("#content").scrollTop(0);
}

showScreen("Home");

// hide context menu when a context menu is not clicked
document.addEventListener("click", function (event: MouseEvent) {
	if (!$(event.target).closest(".context-menu").length) {
		$(".context-menu").removeClass("shown");
	}
});

if (prefs.defaultMaximized) api.ipcSend("maximize");
resizeSidebar(prefs.sidebarWidth);

export function toggleSidebar(forceState?: boolean): void {
	if (typeof forceState == "boolean") {
		if (forceState) {
			document.getElementById("sidebar").classList.add("hidden");
			document.getElementById("commandLine").classList.add("sidebar-hidden");
			document.getElementById("commandLineHistory").classList.add("sidebar-hidden");
			$("#sidebar-toggle").html(featherIcons["chevrons-right"].toSvg());
		} else {
			document.getElementById("sidebar").classList.remove("hidden");
			document.getElementById("commandLine").classList.remove("sidebar-hidden");
			document.getElementById("commandLineHistory").classList.remove("sidebar-hidden");
			$("#sidebar-toggle").html(featherIcons["chevrons-left"].toSvg());
		}
	}

	if (document.getElementById("sidebar").classList.contains("hidden")) {
		document.getElementById("sidebar").classList.remove("hidden");
		document.getElementById("commandLine").classList.remove("sidebar-hidden");
		document.getElementById("commandLineHistory").classList.remove("sidebar-hidden");
		$("#sidebar-toggle").html(featherIcons["chevrons-left"].toSvg());
	} else {
		document.getElementById("sidebar").classList.add("hidden");
		document.getElementById("commandLine").classList.add("sidebar-hidden");
		document.getElementById("commandLineHistory").classList.add("sidebar-hidden");
		$("#sidebar-toggle").html(featherIcons["chevrons-right"].toSvg());
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

// Document Drag-Over \\

document.getElementById("fileDragOverlay").addEventListener("drop", (e: DragEvent) => {
	e.preventDefault();
	e.stopPropagation();
	document.getElementById("dragSidesOverlayContainer").classList.remove("shown");
	document.getElementById("fileDragOverlay").style.zIndex = "-1";

	for (const f of Array.from(e.dataTransfer.files)) {
		console.log("File Path of dragged files: ", f.path);
	}

	if (e.x >= window.innerWidth / 2) {
		console.log("Section 1 Drop");
	} else {
		console.log("Section 0 drop");
	}
});

document.getElementById("fileDragOverlay").addEventListener("dragover", (e) => {
	e.preventDefault();
	e.stopPropagation();

	if (e.x <= window.innerWidth / 2) {
		document.getElementById("dragSection0").classList.add("hovered");
		document.getElementById("dragSection1").classList.remove("hovered");
	} else {
		document.getElementById("dragSection0").classList.remove("hovered");
		document.getElementById("dragSection1").classList.add("hovered");
	}
});

document.addEventListener("dragenter", () => {
	console.log("File is in the Div Drop Space");

	document.getElementById("dragSection0").classList.remove("hovered");
	document.getElementById("dragSection1").classList.remove("hovered");
	document.getElementById("fileDragOverlay").style.zIndex = "999999";
	document.getElementById("dragSidesOverlayContainer").classList.add("shown");
});

document.getElementById("fileDragOverlay").addEventListener("dragleave", () => {
	console.log("File has left Div the Drop Space");
	document.getElementById("fileDragOverlay").style.zIndex = "-1";
	document.getElementById("dragSidesOverlayContainer").classList.remove("shown");
});

window.addEventListener("resize", () => {
	document.querySelectorAll(".context-menu").forEach((elt) => elt.classList.remove("shown"));
});

export function getContextPositionFromMousePos(e: MouseEvent, contextHeight: number, contextWidth: number) {
	let top = e.clientY;
	let left = e.clientX;

	const maxHeight = $(window).height();
	if (top > maxHeight / 2) {
		top -= contextHeight + 20;
	}
	const maxWidth = $(window).width();
	if (left > maxWidth / 2) {
		left -= contextWidth;
	}

	return { top, left };
}

document.addEventListener("contextmenu", (e) => {
	// todo: determine context menu based on clicked element

	// e.composedPath().forEach((target: HTMLElement) => {
	// 	if (!target.hasAttribute || !target.classList) return;
	// 	if (!target.hasAttribute("hasContextMenu")) return;

	// 	if (target.classList.contains("show")) {
	// 		return $("#showContextMenu")
	// 			.css({
	// 				top,
	// 				left
	// 			})
	// 			.addClass("shown")
	// 			.data($(target).data());
	// 	}
	// });

	// $("#dmxInterfaceStatusContext")
	// 	.css({
	// 		top: top,
	// 		left: left
	// 	})
	// 	.addClass("shown");

	// ! Uncomment when not debugging rest of application
	e.preventDefault();
	return false;
});

// prevent text selection
window.onload = () => {
	document.onselectstart = () => {
		return false;
	};
};
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

// ------ \\
// STYLES \\
// ------ \\

// Feather icons
feather.replace();

// fontawesome icons
document.querySelectorAll("[data-awesome]").forEach((elt: HTMLElement) => {
	const svg = document.createElement("img");
	svg.src = `../assets/vendor/fontawesome-desktop/svgs/regular/${elt.dataset.awesome}.svg`;
	elt.replaceWith(svg);
});
