import { Event as ElectronRenderEvent } from "electron/renderer";
import { MainAPI } from "../../main/preload";
import { isNumber } from "../../common/util/is";
import { UserPrefs } from "../../common/UserPrefs";
import * as feather from "feather-icons";
import { icons as featherIcons } from "feather-icons";
import color from "color";
import {
	ChannelData,
	DefinedProfile,
	DMXToPercent,
	FixtureChannel,
	GroupData,
	GroupPaletteItem,
	isWithinRange,
	PercentToDMX
} from "lx_console_backend";
import { CommandLine, ControlKey, Key, MetaKey, ModifierKey, NumericalKey } from "../../common/CommandLine";
import p5 from "p5";

import "../../../css/style.scss";

type BridgedWindow = Window &
	typeof globalThis & {
		mainAPI: any;
	};

export const api: MainAPI = (window as BridgedWindow).mainAPI.api;

export const prefs: UserPrefs = api.getPrefs();

if (api.showFirstUseModal) {
	$("#helpMessage").text(
		"Welcome! I noticed it was your first time using this application. This tab will be your first port of call if you ever get stuck or don't understand something."
	);
	$(".sidebar-item[data-links-to='Help']").addClass("needs-attention");
}

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
	prefs.mainFgColor = color(col).isDark() ? "#c4c4c4" : "#212121";
	$(":root").css("--main-bg", col);
	$(":root").css("--main-fg", prefs.mainFgColor);
}

export function needsAttention(eltId: string) {
	$(`#${eltId}`).addClass("needs-attention");
}

export function attentionRead(eltId: string) {
	$(`#${eltId}`).removeClass("needs-attention");
}

// ###################### \\
// Temporary Funcs / Data \\
// ###################### \\

export function getColor() {
	return color;
}

api.ipcHandle("console.log", (e: ElectronRenderEvent, text: string) => console.log(text));
api.ipcHandle("console.error", (e: ElectronRenderEvent, err: Error) => console.error(err));

api.ipcHandle("prefsShowSideBar", (e: ElectronRenderEvent, value: boolean) => (prefs.showSideBar = value));

api.ipcHandle("onClose", () => {
	prefs.defaultMaximized = api.ipcSendSync("isWindowMaximized");
	api.savePrefs(prefs);
	// ! todo Save all
	// api.saveData(save);

	api.ipcSend("exit");
});

const ATTRIBUTE_CATEGORIES = ["BEAM", "COLOUR", "POSITION", "SHAPE", "FUNCTION", "UNKNOWN"];

export function openPatchFixturesPrompt() {
	const usedChannels = api.ipcSendSync("getPatchChannelNumbers");
	const usedDmxSpace = api.ipcSendSync("getUsedDmxSpace");
	const data = api.ipcSendSync("createPrompt", { file: "patch_add", options: { usedChannels, usedDmxSpace } });
	if (!data) return console.log("Prompt returned no data");
	data.forEach((fx: { channel: number; definedProfile: DefinedProfile; initialAddress: number }) => {
		api.ipcSend("patchAdd", fx.channel, fx.definedProfile, fx.initialAddress);
	});
}

function generateRenameChannelFunc(channel: number) {
	return () => {
		cli.setTokens(["Name", "Patch", `${channel}`]);
	};
}
function generateMoveChannelFunc(channel: number) {
	return () => {
		cli.setTokens(["Move", "Patch", `${channel}`]);
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
		const channelSpan = document.createElement("span");
		channelSpan.id = `patchChannel_channel-${v.channel}`;
		channelSpan.classList.add("patchChannelComponent");
		channelSpan.classList.add("patchChannel_channel");
		channelSpan.textContent = v.channel.toString();
		channelSpan.onclick = generateMoveChannelFunc(v.channel);
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

export function generateGroupSelectFunc(channels: Set<number>) {
	return () => {
		selectedChannels = channels;
	};
}

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
		elt.onclick = generateGroupSelectFunc(group.channels);
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
}

export function forceRefreshGroupList() {
	const groups = api.ipcSendSync("getAllGroups");
	console.log(groups);
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
	channels = channels.sort();
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

export function outputSelectUpdate() {
	if (($("#outputTypeSelect").val() as string) == "raw") {
		$("#channelOutputContainer").hide();
		$("#rawOutputContainer").show();
	} else {
		$("#channelOutputContainer").show();
		$("#rawOutputContainer").hide();
	}
}
outputSelectUpdate();

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

export function renderOutputTable(
	address: number,
	value: { val: number; programmerVal: number },
	channel: number,
	type: string
) {
	$(`#raw-output-${address}-value`).text(value.programmerVal >= 0 ? value.programmerVal : value.val);
	if (type == "INTENSITY") {
		$(`#channel-output-${channel}-value`).text(
			Math.round(DMXToPercent(value.programmerVal >= 0 ? value.programmerVal : value.val))
		);
	}
}

type FixtureAttributeMap = Map<string, { channelData: ChannelData; addressChannels: FixtureChannel[] }>;

function renderAttributeControllers(fixtures: Map<string, FixtureAttributeMap>) {
	ATTRIBUTE_CATEGORIES.forEach((attr) => {
		$(`#${attr.toLowerCase()}ControlsContainer`).empty();
		const fxs = fixtures.get(attr);
		// console.log(fxs);
		fxs.forEach((v, k) => {
			const profileChannelMode = k.split("_")[1];
			const fixtureContainerElt = document.createElement("div");
			fixtureContainerElt.id = `${
				v.channelData.profile.id
			}_${profileChannelMode}_${attr.toLowerCase()}_controller`;
			fixtureContainerElt.classList.add("attribute-controller-container");

			const fixtureNameElt = document.createElement("span");
			fixtureNameElt.id = `${
				v.channelData.profile.id
			}_${profileChannelMode}_${attr.toLowerCase()}_controller_name`;
			fixtureNameElt.classList.add("attribute-controller-name");
			fixtureNameElt.textContent = `${v.channelData.profile.name} (${
				v.channelData.profile.channelModes[v.channelData.profile.options.channelMode].count
			})`;
			fixtureContainerElt.appendChild(fixtureNameElt);

			const attributesContainerElt = document.createElement("div");
			attributesContainerElt.id = `${
				v.channelData.profile.id
			}_${profileChannelMode}_${attr.toLowerCase()}_attribute_controller_list`;
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
					attributeSet(
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

				const attributeBoundsOption = document.createElement("div");
				attributeBoundsOption.id = `${v.channelData.profile.id}_${profileChannelMode}_unset_attribute_bound`;
				attributeBoundsOption.classList.add("attributeBoundsOption");
				attributeBoundsOption.textContent = "Unset";
				attributeBoundsContainerElt.appendChild(attributeBoundsOption);

				if (!ac.bounds?.length) return;
				ac.bounds.forEach((bound) => {
					const attributeBoundsOption = document.createElement("div");
					attributeBoundsOption.id = `${v.channelData.profile.id}_${profileChannelMode}_${bound.name}_${bound.initial}_attribute_bound`;
					attributeBoundsOption.classList.add("attributeBoundsOption");
					attributeBoundsOption.textContent = `${bound.name} (${bound.initial} > ${bound.final})`;
					attributeBoundsOption.addEventListener("click", () => {
						attributeSet(
							{ targetId: v.channelData.profile.id, targetOptions: profileChannelMode },
							ac.addressOffset,
							bound.initial
						);
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

function renderAttributePalettes(fixtures: Map<string, FixtureAttributeMap>) {
	ATTRIBUTE_CATEGORIES.forEach((attr) => {
		$(`#${attr.toLowerCase()}PalettesContainer`).empty();
		const fxs = fixtures.get(attr);
		console.log(fxs);
		fxs.forEach((v, k) => {
			const profileChannelMode = k.split("_")[1];
			const fixtureContainerElt = document.createElement("div");
			fixtureContainerElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${attr.toLowerCase()}_palettes`;
			fixtureContainerElt.classList.add("attribute-controller-container");

			const fixtureNameElt = document.createElement("span");
			fixtureNameElt.id = `${v.channelData.profile.id}_${profileChannelMode}_${attr.toLowerCase()}_palettes_name`;
			fixtureNameElt.classList.add("attribute-controller-name");
			fixtureNameElt.textContent = `${v.channelData.profile.name} (${
				v.channelData.profile.channelModes[v.channelData.profile.options.channelMode].count
			})`;
			fixtureContainerElt.appendChild(fixtureNameElt);

			const attributesContainerElt = document.createElement("div");
			attributesContainerElt.id = `${
				v.channelData.profile.id
			}_${profileChannelMode}_${attr.toLowerCase()}_attribute_palettes_list`;
			attributesContainerElt.classList.add("attribute-controller-list-container");
			fixtureContainerElt.appendChild(attributesContainerElt);
		});
	});
}

// --- \\
// DMX \\
// --- \\

export let selectedChannels = new Set<number>();

export function setSelectedChannels(sc: Set<number>) {
	const existingChannels = api.ipcSendSync("getPatchChannelNumbers");
	selectedChannels = new Set(Array.from(sc).filter((num) => existingChannels.includes(num)));

	// update selection highlights
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
			if (!attr.has(`${profileId}_${profileChannelMode}`))
				attr.set(`${profileId}_${profileChannelMode}`, { channelData: chData, addressChannels });
		});
		// if(!attr.size) return; // removes entire type map if no fixtures (and therefore no channels) use it
		attributes.set(type, attr);
	});
	// console.log(
	// 	JSON.stringify(attributes, (key, value) => {
	// 		if (value instanceof Map) {
	// 			return {
	// 				dataType: "Map",
	// 				value: Array.from(value.entries()) // or with spread: value: [...value]
	// 			};
	// 		} else {
	// 			return value;
	// 		}
	// 	})
	// );
	console.log(attributes);
	renderAttributeControllers(attributes);
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

	// <div class="notification-footer">
	// 			<span id="notification-time-${id}">Just Now</span>
	// 			<span class="notification-wait" id="notification-wait-${id}">Pause</span>
	// 		</div>

	let counter = timeSec | 20;
	const interval = setInterval(() => {
		counter--;

		// !
		// $(`#notification-time-${id}`).text(`${counter} seconds remaining`);
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
		// !
		// $(`#notification-time-${id}`).text("Notification Pinned");
	});

	if (callback) $(`#notification-${id}`).on("click", callback);

	idCount++;
}

// api.ipcHandle("bufferUpdate", (e, data) => renderRawOutputTable(data));
api.ipcHandle("addressUpdate", (e, address, value, channel, type) => renderOutputTable(address, value, channel, type));

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
	// createNotification("DMX Interface", "Interface Connected!");
	// console.log("Serialport opening");
	$("#dmxInterfaceStatus").removeClass("needs-attention");
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["loader"].toSvg());
});

api.ipcHandle("serialportOpeningFailed", () => {
	createNotification("DMX Interface", "Failed to connect to interface");
	console.log("Serialport opening failed");
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
	console.log("Serialport Retry Fail");
	console.log(err);
	$("#dmxInterfaceStatus>.statusbar-item-content>.feather-container").html(featherIcons["disc"].toSvg());
	$("#dmxInterfaceStatus").removeClass("needs-attention");
});

api.ipcHandle("patchAdd", () => forceRefreshPatchList());
api.ipcHandle("patchDelete", () => forceRefreshPatchList());
api.ipcHandle("patchMove", () => forceRefreshPatchList());
api.ipcHandle("channelNameUpdate", () => forceRefreshPatchList());

api.ipcHandle("groupAdd", () => forceRefreshGroupList());
api.ipcHandle("groupDelete", () => forceRefreshGroupList());
api.ipcHandle("groupMove", () => forceRefreshGroupList());

api.ipcHandle("cueAdd", (e: ElectronRenderEvent, cue) => console.log("cueAdd", cue));
api.ipcHandle("cueDelete", (e: ElectronRenderEvent, id: number | Set<number>) => console.log("cueDelete", id));
api.ipcHandle("cueMove", (e: ElectronRenderEvent, id1: number, id2: number) => console.log("cueMove", id1, id2));

function attributeSet(
	target: string | { targetId: string; targetOptions: string },
	addressOffset: number,
	addressValue: number
) {
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
		channel: ch,
		addressOffset: addressOffset,
		value: addressValue
	}));
	api.ipcSend("updateChannelsAttribute", { channels: chs });
}

export function parseSelectionString(tokens: string[], modifyFrom?: Set<number>): Set<number> {
	const channels = modifyFrom ? modifyFrom : new Set<number>();
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		console.log(token);
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
			const group = api.ipcSendSync("getGroup", parseInt(tokens[i + 1])) as GroupData;
			console.log(tokens[i - 1]);
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
	} else if (tokens[0] == "-" || tokens[0] == "+" || tokens[0] == "Groups" || tokens[1] == "Groups") {
		if (tokens[1] == "-" || tokens[1] == "+") {
			// todo: increment, decrement intensity
		}
		console.log(tokens);
		setSelectedChannels(parseSelectionString(tokens, selectedChannels));
		return true;
	}

	if (setIntensity()) return true;

	if (tokens[0] == "Name") {
		if (tokens[1] == "Patch") {
			if (isNumber(tokens[2])) {
				const name = api.ipcSendSync("createPrompt", { file: "text_input", options: {} });
				if (!name || !name.length) return false;
				api.ipcSend("patchChannelRename", parseInt(tokens[2]), name);
				return true;
			}
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
	}

	if (tokens[0] == "Record") {
		if (tokens[1] == "Patch") {
			openPatchFixturesPrompt();
			return true;
		}
		if (tokens[1] == "Groups") {
			if (!isNumber(tokens[2])) return false;
			const groupNo = parseInt(tokens[2]);
			api.ipcSend("groupAdd", groupNo, selectedChannels);
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

		if (key_l == "l") return api.ipcSend("lock");
	}

	if (key_l == "@") return cli.addToken("@");
	if (key_l == ">") return cli.addToken(">");
	if (key_l == "/") return cli.addToken(">");
	if (key_l == "+") return cli.addToken("+");
	if (key_l == "-") return cli.addToken("-");

	if (key_l == "d") return setSelectedChannels(new Set());
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
	// if (Object.values(AlphabeticalKey).includes(e.key)) cli.addTokenPart(e.key);
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
				attributeSet(
					elt.dataset.clickTarget,
					parseInt(elt.dataset.addressOffset),
					parseInt(elt.dataset.addressValue)
				);
				break;
			}
			default:
				break; // No action;
		}
	});
});

new p5((s: p5) => {
	let canvas: p5.Renderer;
	let canvasWidth;
	let canvasHeight;
	const XOFFSET = 10;
	const YOFFSET = 10;

	function updateBoardSizes() {
		console.log($("#panTiltGridContainer"));

		const board_DOM = document.getElementById("panTiltGridContainer");
		console.log(board_DOM);
		console.log(board_DOM.offsetHeight);
		canvasWidth = board_DOM.offsetWidth - XOFFSET * 2;
		canvasHeight = board_DOM.offsetHeight - YOFFSET * 2;

		const size = s.min(canvasWidth, canvasHeight);
		canvasHeight = size;
		canvasWidth = size;
		s.resizeCanvas(canvasWidth + XOFFSET * 2, canvasHeight + YOFFSET * 2);

		canvas.parent(document.getElementById("panTiltGridContainer"));
	}

	s.setup = () => {
		canvas = s.createCanvas(10, 10);
		updateBoardSizes();
	};

	s.windowResized = () => {
		updateBoardSizes();
	};

	s.draw = () => {
		s.background(80);
	};
}, document.getElementById("panTiltGridContainer"));

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
			"hmtl elt with id #" +
				screenName +
				" and class .screen was not found by jquery selection and therefore could not be displayed"
		);
		showScreen("Home");
	}

	$("#content").scrollTop(0);
}

showScreen("Home");

let modalOpen = false;
$(".modal").on("hidden.bs.modal", () => (modalOpen = false));
$(".modal").on("shown.bs.modal", () => (modalOpen = true));

export const modalIsOpen = () => modalOpen;

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

document.addEventListener("dragenter", (event) => {
	console.log("File is in the Div Drop Space");

	document.getElementById("dragSection0").classList.remove("hovered");
	document.getElementById("dragSection1").classList.remove("hovered");
	document.getElementById("fileDragOverlay").style.zIndex = "999999";
	document.getElementById("dragSidesOverlayContainer").classList.add("shown");
});

document.getElementById("fileDragOverlay").addEventListener("dragleave", (event) => {
	console.log("File has left Div the Drop Space");
	document.getElementById("fileDragOverlay").style.zIndex = "-1";
	document.getElementById("dragSidesOverlayContainer").classList.remove("shown");
});

window.addEventListener("resize", () => {
	document.querySelectorAll(".context-menu").forEach((elt) => elt.classList.remove("shown"));
});

document.addEventListener("contextmenu", (e) => {
	// todo: determine context menu based on clicked element
	let top = e.pageY;
	let left = e.pageX;

	const maxHeight = $(window).height();
	if (top > maxHeight / 2) {
		top -= $("#dmxInterfaceStatusContext").height() + 20;
	}
	const maxWidth = $(window).width();
	if (left > maxWidth / 2) {
		left -= $("#dmxInterfaceStatusContext").width();
	}

	$("#dmxInterfaceStatusContext")
		.css({
			top: top,
			left: left
		})
		.addClass("shown");

	// ! Remove when not debugging
	// e.preventDefault();
	// return false;
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