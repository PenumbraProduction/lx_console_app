import { contextBridge, ipcRenderer, IpcRendererEvent, shell, clipboard } from "electron";
import * as fs from "fs";
import * as remote from "@electron/remote";
import { Titlebar, Color } from "@treverix/custom-electron-titlebar";
import { compare } from "semver";
import { deserialize } from "typescript-json-serializer";
import { UserPrefs } from "../common/UserPrefs";
import { Save } from "../common/Save";
import { NotebookItem } from "../common/NotebookItem";

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
	loadPageData(fileName: string): NotebookItem;
	savePage(page : NotebookItem) : void;
	savePageData(fileName: string, docObject: { [key: string]: any }): void;
	openSaveLocation(): void;
	changeSaveLocation(): void;
	revertToDefaultSaveLocation(): void;
	openLink(link: "website" | "download" | "docs" | "changelogs" | "github" | "issues" | "feedback" | "feather"): void;

	writeClipboard(text : string): void;
	readClipboard(): string;
};

const api: MainAPI = {
	showFirstUseModal: false,

	showWhatsNewModal: false,

	ipcHandle: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
		ipcRenderer.on(channel, listener);
	},

	ipcSend: (channel: string, ...args: any[]): void => {
		ipcRenderer.send(channel, args);
	},

	ipcSendSync: (channel: string, ...args: any[]): any => {
		return ipcRenderer.sendSync(channel, args);
	},

	defaultSaveLocation: (): string => {
		return defaultSaveLocation;
	},

	saveLocation: (): string => {
		return saveLocation;
	},

	getPrefs: (): UserPrefs => {
		return deserialize<UserPrefs>(JSON.stringify(prefs), UserPrefs);
	},

	savePrefs: (prefsObj: UserPrefs): void => {
		if (canSavePrefs == true) {
			prefs = prefsObj;
			fs.writeFileSync(defaultSaveLocation + "/prefs.json", JSON.stringify(prefs, null, 4), "utf-8");
		}
	},

	getSave: (): Save => {
		return deserialize<Save>(JSON.stringify(save), Save);
	},

	saveData: (saveObj: Save): void => {
		if (canSaveData == true) {
			save = saveObj;
			fs.writeFileSync(saveLocation + "/save.json", JSON.stringify(save, null, 4), "utf-8");
		}
	},

	loadPageData: (fileName: string): NotebookItem => {
		if (!fileName.includes("/") && !fileName.includes("\\")) {
			if (fs.existsSync(saveLocation + "/notes/" + fileName)) {
				return deserialize<NotebookItem>(fs.readFileSync(saveLocation + "/notes/" + fileName, "utf-8").toString(), NotebookItem);
			}
		}
		return null;
	},

	savePage: (page : NotebookItem): void => {
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

	changeSaveLocation: (): void => {
		const newLocation = ipcRenderer.sendSync("changeSaveLocation");
		if (newLocation !== "") {
			if (isValidDir(newLocation)) {
				fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", newLocation, "utf-8");
				ipcRenderer.send("restart");
			}
		}
	},

	revertToDefaultSaveLocation: (): void => {
		fs.writeFileSync(defaultSaveLocation + "/saveLocation.txt", defaultSaveLocation, "utf-8");
		ipcRenderer.send("restart");
	},

	openLink: (
		link: "website" | "download" | "docs" | "changelogs" | "github" | "issues" | "feedback" | "feather" | "license"
	): void => {
		switch (link) {
			case "website":
				shell.openExternal("https://Noteworm.github.io/");
				break;
			case "download":
				shell.openExternal("https://Noteworm.github.io/download/");
				break;
			case "docs":
				shell.openExternal("https://Noteworm.github.io/docs/");
				break;
			case "changelogs":
				shell.openExternal("https://Noteworm.github.io/updates/");
				break;
			case "github":
				shell.openExternal("https://github.com/Noteworm/noteworm-client");
				break;
			case "issues":
				shell.openExternal("https://github.com/Noteworm/noteworm-client/issues");
				break;
			case "feedback":
				shell.openExternal("https://forms.gle/spa9b6EPwBfVs46YA");
				break;
			case "feather":
				shell.openExternal("https://www.feathericons.com/");
				break;
			case "license":
				shell.openExternal("https://creativecommons.org/licenses/by-nc/4.0/");
				break;
		}
	},

	writeClipboard(text : string) : void {
		clipboard.writeText(text);
	},

	readClipboard() : string {
		return clipboard.readText();
	}
};

// LOAD PREFS

if (fs.existsSync(defaultSaveLocation + "/prefs.json")) {
	try {
		const json = fs.readFileSync(defaultSaveLocation + "/prefs.json", "utf-8").toString();
		prefs = deserialize<UserPrefs>(json, UserPrefs);

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

	// Check for old save
	try {
		const testObject = JSON.parse(json);
		if (testObject["version"] === undefined) {
			try {
				save = convertOldSave(testObject);
				canSaveData = true;
			} catch (err) {
				ipcRenderer.send(
					"errorLoadingData",
					`Your save.json file in '${saveLocation}' could not be converted to the new format. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`
				);
			}
		} else {
			try {
				save = deserialize<Save>(json, Save);
				canSaveData = true;
			} catch (err) {
				ipcRenderer.send(
					"errorLoadingData",
					`Your save.json file in '${saveLocation}' could not be parsed. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`
				);
			}
		}
	} catch (err) {
		ipcRenderer.send(
			"errorLoadingData",
			`Your save.json file in '${saveLocation}' could not be parsed. Check the save.json file for issues, and/or report this problem to the GitHub Issues page.\n\n${err}`
		);
	}

	api.saveData(save);
} else {
	//TODO REMOVE
	save = new Save();

	canSaveData = true;

	api.saveData(save);
}

if (!fs.existsSync(saveLocation + "/notes/")) {
	fs.mkdirSync(saveLocation + "/notes/");
}

if (!fs.existsSync(defaultSaveLocation + "/userStyles.css")) {
	fs.writeFileSync(
		defaultSaveLocation + "/userStyles.css",
		"/*\n    Enter custom CSS rules for Noteworm in this file.\n    Use Inspect Element in the DevTools (Ctrl-Shift-I) in Noteworm to find id's and classes.\n*/"
	);
}

function convertOldSave(oldSave: any): Save {
	const newSave = new Save();

	// check old save number
	// add old data to newSave object

	return newSave;
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
