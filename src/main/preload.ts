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
 *  See https://github.com/LordFarquhar/lx_console_app/blob/main/LICENSE an 
 *  implementation of GPLv3 (https://www.gnu.org/licenses/gpl-3.0.html)
 */

import { contextBridge, ipcRenderer, IpcRendererEvent, shell, clipboard } from "electron";
import * as fs from "fs";
import * as util from "util";
import * as remote from "@electron/remote";
import { Titlebar, Color } from "@treverix/custom-electron-titlebar";
import { compare } from "semver";
import { JsonSerializer, throwError } from "typescript-json-serializer";
const jsonSerializer = new JsonSerializer({
	errorCallback: throwError,
	nullishPolicy: {
		undefined: "allow",
		null: "allow"
	}
});
import { UserPrefs } from "../common/UserPrefs";
import { Save } from "../common/Save";
import { ShowData } from "../common/ShowFile";

const version = "1.0.0"; // VERSION CHANGE NOTICE

let save: Save = null;
let prefs: UserPrefs = null;

let canSavePrefs = false;
let canSaveData = false;

const defaultSaveLocation = ipcRenderer.sendSync("defaultDataDir");
let saveLocation = "";

if (!fs.existsSync(defaultSaveLocation + "/saveLocation.txt")) {
	saveLocation = defaultSaveLocation;
	fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", defaultSaveLocation, "utf-8");
} else {
	saveLocation = fs.readFileSync(defaultSaveLocation + "/saveLocation.txt", "utf-8").toString();
}

export type MainAPI = {
	showFirstUseModal: boolean;
	showWhatsNewModal: boolean;
	ipcHandle(channel: string, listener: (event: any, ...args: any[]) => void): void;
	ipcSend(channel: string, ...args: any[]): void;
	ipcSendSync(channel: string, ...args: any[]): any;
	defaultSaveLocation(): string;
	saveLocation(): string;
	getPrefs(): UserPrefs;
	savePrefs(prefsObj: UserPrefs): void;
	getSave(): Save;
	saveData(saveObj: Save): void;
	loadPageData(fileName: string): ShowData;
	savePage(page: ShowData): void;
	savePageData(fileName: string, docObject: { [key: string]: any }): void;
	openSaveLocation(): void;

	writeClipboard(text: string): void;
	readClipboard(): string;

	inspect(obj:string): string;
};

const api: MainAPI = {
	showFirstUseModal: false,

	showWhatsNewModal: false,

	ipcHandle: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
		ipcRenderer.on(channel, listener);
	},

	ipcSend: (channel: string, ...args: any[]): void => {
		ipcRenderer.send(channel, ...args);
	},

	ipcSendSync: (channel: string, ...args: any[]): any => {
		return ipcRenderer.sendSync(channel, ...args);
	},

	defaultSaveLocation: (): string => {
		return defaultSaveLocation;
	},

	saveLocation: (): string => {
		return saveLocation;
	},

	getPrefs: (): UserPrefs => {
		return jsonSerializer.deserializeObject<UserPrefs>(JSON.stringify(prefs), UserPrefs);
	},

	savePrefs: (prefsObj: UserPrefs): void => {
		if (canSavePrefs == true) {
			prefs = prefsObj;
			fs.writeFileSync(defaultSaveLocation + "/prefs.json", JSON.stringify(prefs, null, 4), "utf-8");
			fs.writeFileSync(defaultSaveLocation + "/prefs.json", JSON.stringify(jsonSerializer.serializeObject(prefs), null, 4), "utf-8");
		}
	},

	getSave: (): Save => {
		return jsonSerializer.deserializeObject<Save>(JSON.stringify(save), Save);
	},

	saveData: (saveObj: Save): void => {
		if (canSaveData == true) {
			save = saveObj;
			// fs.writeFileSync(saveLocation + "/save.json", JSON.stringify(save, null, 4), "utf-8");
			fs.writeFileSync(saveLocation + "/save.json", JSON.stringify(jsonSerializer.serializeObject(save), null, 4), "utf-8");
		}
	},

	loadPageData: (fileName: string): ShowData => {
		if (!fileName.includes("/") && !fileName.includes("\\")) {
			if (fs.existsSync(saveLocation + "/notes/" + fileName)) {
				return jsonSerializer.deserializeObject<ShowData>(
					fs.readFileSync(saveLocation + "/notes/" + fileName, "utf-8").toString(),
					ShowData
				);
			}
		}
		return null;
	},

	savePage: (page: ShowData): void => {
		if (!page.skeleton.fileName.includes("/") && !page.skeleton.fileName.includes("\\") && canSaveData == true) {
			fs.writeFileSync(saveLocation + "/notes/" + page.skeleton.fileName, JSON.stringify(page), "utf-8");
		}
	},

	savePageData: (fileName: string, docObject: { [key: string]: any }): void => {
		if (!fileName.includes("/") && !fileName.includes("\\") && canSaveData == true) {
			fs.writeFileSync(saveLocation + "/notes/" + fileName, JSON.stringify(docObject), "utf-8");
		}
	},

	openSaveLocation: (): void => {
		if (isValidDir(saveLocation)) shell.openPath(saveLocation);
	},

	writeClipboard(text: string): void {
		clipboard.writeText(text);
	},

	readClipboard(): string {
		return clipboard.readText();
	},

	inspect(obj) {
		return util.inspect(obj, {depth: null});
	}
};

// LOAD PREFS

if (fs.existsSync(defaultSaveLocation + "/prefs.json")) {
	try {
		const json = fs.readFileSync(defaultSaveLocation + "/prefs.json", "utf-8").toString();
		prefs = jsonSerializer.deserializeObject<UserPrefs>(json, UserPrefs);

		canSavePrefs = true;
	} catch (err) {
		ipcRenderer.send(
			"errorLoadingData",
			`Your prefs.json file in '${defaultSaveLocation}' could not be parsed. Check the prefs.json file for issues or try deleting it.\n\n${err}`
		);
	}
} else {
	prefs = new UserPrefs();
	saveLocation = defaultSaveLocation;
	canSavePrefs = true;
	api.savePrefs(prefs);

	api.showFirstUseModal = true;
}

if (compare(version, prefs.lastUseVersion) == 1) {
	api.showWhatsNewModal = true;
	prefs.lastUseVersion = version;
}

// LOAD SAVE

if (fs.existsSync(saveLocation + "/save.json")) {
	const json = fs.readFileSync(saveLocation + "/save.json", "utf-8").toString();

	try {
		save = jsonSerializer.deserializeObject<Save>(json, Save);
		canSaveData = true;
	} catch (err) {
		ipcRenderer.send(
			"errorLoadingData",
			`Your save.json file in '${saveLocation}' could not be parsed. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`
		);
	}

	api.saveData(save);
} else {
	save = new Save();
	canSaveData = true;
	api.saveData(save);
}

function isValidDir(path: string): boolean {
	if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
		return true;
	}
	return false;
}

contextBridge.exposeInMainWorld("mainAPI", {
	api: api
});

// Initialize custom titlebar and highlight example code
window.addEventListener("DOMContentLoaded", () => {
	if (process.platform === "win32") {
		const titlebar = new Titlebar({
			backgroundColor: Color.fromHex("#343A40"),
			unfocusEffect: true,
			icon: "../assets/icons/icon.ico",
			overflow: "hidden"
		});

		ipcRenderer.on("updateMenubar", () => {
			titlebar.updateMenu(remote.Menu.getApplicationMenu());
		});
	}
});
