import fs from "fs";
import { app, ipcMain, shell } from "electron";

import { JsonSerializer, throwError } from "typescript-json-serializer";
const jsonSerializer = new JsonSerializer({
	errorCallback: throwError,
	nullishPolicy: {
		undefined: "allow",
		null: "allow"
	}
});

import { errorPopup, iconPath, mainWindow } from "./main";
import { Save } from "../common/Save";
import { generateShowData, ShowData, ShowSkeleton } from "../common/ShowFile";
import moment from "moment";
import { desk } from "lx_console_backend";
import path from "path";

let save: Save = null;
let canSaveData = false;

const defaultSaveLocation = app.getPath("userData");
let saveLocation = "";

function ipcSend(channel: string, data?: any) {
	if (mainWindow?.webContents?.send) {
		mainWindow.webContents.send(channel, data);
	}
}

export function loadSaves() {
	if (!fs.existsSync(defaultSaveLocation + "/saveLocation.txt")) {
		saveLocation = defaultSaveLocation;
		fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", defaultSaveLocation, "utf-8");
	} else {
		saveLocation = fs.readFileSync(defaultSaveLocation + "/saveLocation.txt", "utf-8").toString();
	}

	if (fs.existsSync(saveLocation + "/save.json")) {
		const json = fs.readFileSync(saveLocation + "/save.json", "utf-8").toString();

		try {
			save = jsonSerializer.deserializeObject<Save>(json, Save);
			canSaveData = true;
		} catch (err) {
			errorPopup(
				"errorLoadingData",
				`Your save.json file in '${saveLocation}' could not be parsed. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`,
				{ allowContinue: false }
			);
		}

		saveData(save);
	} else {
		save = new Save();
		canSaveData = true;
		saveData(save);
	}

	if (!fs.existsSync(saveLocation + "/shows/")) {
		fs.mkdirSync(saveLocation + "/shows/");
	}
}
export function getSave(): Save {
	return jsonSerializer.deserializeObject<Save>(JSON.stringify(save), Save);
}

export function saveData(saveObj: Save): void {
	if (canSaveData == true) {
		save = saveObj;
		fs.writeFileSync(saveLocation + "/save.json", JSON.stringify(jsonSerializer.serializeObject(save), null, 4), "utf-8");
		ipcSend("saveUpdated", save);
	}
}

export function getShowData(showId: string): ShowData {
	const showSkele = save.shows.find((sh) => sh.id == showId);
	if (!showSkele) return null;
	if (fs.existsSync(saveLocation + "/shows/" + showSkele.fileName)) {
		return jsonSerializer.deserializeObject<ShowData>(fs.readFileSync(saveLocation + "/shows/" + showSkele.fileName, "utf-8").toString(), ShowData);
	}
}

export function saveShowFile(show: ShowData): void {
	show.skeleton.lastModified = moment.now();
	save.shows[save.shows.findIndex((sh) => sh.id == show.skeleton.id)].lastModified = show.skeleton.lastModified;
	ipcSend("saveUpdated", save);
	if (!show.skeleton.fileName.includes("/") && !show.skeleton.fileName.includes("\\") && canSaveData == true) {
		fs.writeFileSync(saveLocation + "/shows/" + show.skeleton.fileName, JSON.stringify(show), "utf-8");
	}
}

export function openSaveLocation(): void {
	if (isValidDir(saveLocation)) shell.openPath(saveLocation);
}

export function isValidDir(path: string): boolean {
	if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
		return true;
	}
	return false;
}

export function newShow(showName: string) {
	const show = new ShowData(showName);
	save.shows.push(show.skeleton);
	saveData(save);
	saveShowFile(show);

	desk.clearAll();
	ipcSend("loadedShow", show);
	return show.skeleton.id;
}

export function saveShow(showSkeleton: ShowSkeleton) {
	const deskData = desk.saveSerialize();
	saveShowFile(generateShowData(showSkeleton, deskData));
}

export function loadShow(showId: string) {
	ipcSend("Loading show", showId);

	const showData = getShowData(showId);
	if (showData == null) return ipcSend("loadingShowFailed");

	if (showData.desk) desk.saveDeserialize(showData.desk);
	else desk.clearAll();
	ipcSend("loadedShow", showData);
}

export function hasShow(showId: string) {
	return save.shows.findIndex((shSkele) => shSkele.id == showId) >= 0;
}

export function includeShow(showData: ShowData) {
	if (hasShow(showData.skeleton.id)) return;
	save.shows.push(showData.skeleton);
	saveShowFile(showData);
}

export function renameShow(id: string, name: string) {
	const showIdx = save.shows.findIndex((shSk) => shSk.id == id);
	if (showIdx < 0) return ipcSend("renameCurrentShowFailed");
	save.shows[showIdx].name = name;
	const showData = getShowData(id);
	showData.skeleton.name = name;
	saveShowFile(generateShowData(showData.skeleton, showData.desk));
	saveData(save);
	ipcSend("updateCurrentShow", showData);
}

export function deleteShow(id: string) {
	if (!hasShow(id)) return ipcSend("showDeleteFailed");
	const showSkele = save.shows.find((shSkele) => shSkele.id == id);
	save.shows = save.shows.filter((shSkele) => shSkele.id != id);
	fs.unlinkSync(saveLocation + "/shows/" + showSkele.fileName);
	saveData(save);
	ipcSend("showDeleted", id);
}

ipcMain.on("startShowFileDrag", (event, showId) => {
	const show = save.shows.find((sh) => sh.id == showId);
	const filePath = path.join(saveLocation, "shows", show.fileName);
	const tempFilePath = path.join(saveLocation, "temp", `${show.name}.lxshow`);
	fs.writeFileSync(tempFilePath, fs.readFileSync(filePath), "utf-8");

	event.sender.startDrag({
		file: tempFilePath,
		icon: path.join(__dirname, iconPath)
	});
});

ipcMain.on("endShowFileDrag", (event, showId) => {
	const show = save.shows.find((sh) => sh.id == showId);
	const tempFilePath = path.join(saveLocation, "temp", `${show.name}.lxshow`);
	if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
});

ipcMain.on("getSave", (e) => (e.returnValue = getSave()));
ipcMain.on("saveData", (e, data) => saveData(data));

ipcMain.on("getShow", (e, showId) => (e.returnValue = getShowData(showId)));
ipcMain.on("saveShow", (e, showSkeleton) => saveShow(showSkeleton));
ipcMain.on("newShow", (e, showName) => (e.returnValue = newShow(showName)));

ipcMain.on("renameShow", (e, showId, showName) => (e.returnValue = renameShow(showId, showName)));

ipcMain.on("deleteShow", (e, showSkeleton) => (e.returnValue = deleteShow(showSkeleton)));

ipcMain.on("loadShow", (e, showId) => (e.returnValue = loadShow(showId)));

ipcMain.on("openSaveLocation", () => openSaveLocation());
