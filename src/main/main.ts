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

import { app, BrowserWindow, dialog, MessageBoxOptions, ipcMain, Menu, MenuItem, shell, screen } from "electron";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as remote from "@electron/remote/main";
import contextMenu from "electron-context-menu";
import * as log from "electron-log";
import { createPromptWindow } from "./PromptManager";
import { ShowData } from "../common/ShowFile";

log.catchErrors({
	showDialog: false,
	onError(e) {
		errorPopup(e);
	}
});

import * as SavesManager from "./savesManager";
import * as PrefsManager from "./prefsManager";
import * as VersionManager from "./versionManager";

PrefsManager.loadPrefs();
SavesManager.loadSaves();
// VersionManager.checkForUpdates();

import { loadProfileLibrary, updateProfileLibrary } from "./OFLManager";
import * as DmxManager from "./dmxManager";
import { wait } from "lx_console_backend";

import { inspect as utilInspect } from "util";

export function inspect(a: any) {
	return utilInspect(a, { depth: null });
}

export let mainWindow: BrowserWindow = null;
const gotTheLock = app.requestSingleInstanceLock();
export let iconPath = "";

app.disableHardwareAcceleration();

if (!gotTheLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});

	app.on("ready", createWindow);

	app.commandLine.appendSwitch("--autoplay-policy", "no-user-gesture-required");

	app.on("window-all-closed", function () {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("render-process-gone", (event, webContents, details) => {
		if (details.reason == "killed") return;
		//
	});

	app.on("second-instance", (e, argv) => {
		if (!argv[2] || !argv[2].length) return;
		const filePath = argv[2];
		loadShowOnLoad(filePath);
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
}

function loadShowOnLoad(filePath: string) {
	if (!SavesManager.isValidDir(filePath)) return;
	const pathParts = filePath.split(".");
	if (pathParts[pathParts.length - 1] != ".lxshow") return;
	const fileContent = fs.readFileSync(filePath).toString();
	const showData = JSON.parse(fileContent) as ShowData;

	// todo: parse all content.

	const showId = showData.skeleton.id;

	mainWindow.webContents.send("forceSaveShow");
	if (!SavesManager.hasShow(showId)) {
		SavesManager.includeShow(showData);
	}
	SavesManager.loadShow(showId);
}

app.on("web-contents-created", (e, contents) => contents.on("will-navigate", (event) => event.preventDefault()));

let splashWindow: BrowserWindow;

function createWindow() {
	const cursorScreenPoint = screen.getCursorScreenPoint();
	const screenToUse = screen.getDisplayNearestPoint(cursorScreenPoint);

	let useFrame = true;

	if (process.platform === "win32") {
		useFrame = false;
		iconPath = "../../assets/icons/icon.ico";
	} else if (process.platform === "linux") {
		iconPath = "../../assets/icons/64x64.png";
	} else if (process.platform === "darwin") {
		iconPath = "../../assets/icons/icon.icns";
	}

	splashWindow = new BrowserWindow({
		width: 600,
		height: 400,
		webPreferences: {
			preload: __dirname + "/splash_preload.js"
		},
		frame: false,
		alwaysOnTop: false,
		icon: path.join(__dirname, iconPath),
		show: false
	});

	splashWindow.setBounds(screenToUse.bounds);
	splashWindow.setSize(600, 400);
	splashWindow.center();

	splashWindow.loadFile("html/splash.html");

	const splashWindowLoad = new Promise((resolve) => splashWindow.webContents.once("dom-ready", resolve));

	splashWindow.on("show", () => {
		splashWindow.focus();
		splashWindow.focusOnWebView();
	});
	splashWindow.webContents.once("dom-ready", () => splashWindow.show());

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		frame: useFrame,
		minWidth: 920,
		minHeight: 500,
		webPreferences: {
			preload: __dirname + "/preload.js"
		},
		icon: path.join(__dirname, iconPath),
		show: false,
		title: "LX Console"
	});

	mainWindow.setBounds(screenToUse.bounds);
	mainWindow.setSize(1280, 720);
	mainWindow.center();

	remote.enable(mainWindow.webContents);
	remote.initialize();

	mainWindow.loadFile("html/index.html");

	contextMenu({
		showSearchWithGoogle: false,
		showLookUpSelection: false
	});

	Menu.setApplicationMenu(normalMenu);

	mainWindow.webContents.once("dom-ready", async () => {
		mainWindow.hide(); // ! for some reason main window shows itself again, put this here to hide it until we are ready

		await splashWindowLoad;
		splashWindow.webContents.send("updateLoadingJob", "Starting Desk Manager...");

		await DmxManager.init().catch(async (e: Error) => {
			splashWindow.webContents.send("updateLoadingJob", e.message, "error");
			await wait(5000);
			app.quit();
		});

		splashWindow.webContents.send("updateLoadingJob", "Loading Profile Library...");
		await loadProfileLibrary();

		// VersionManager.startAutoUpdateChecker();

		mainWindow.show();
		// mainWindow.webContents.openDevTools();
		splashWindow.close();
	});

	mainWindow.on("close", (e) => {
		e.preventDefault();
		mainWindow.webContents.send("onClose");
	});
}

function getMacOsVersion() {
	const release = Number(os.release().split(".")[0]);
	return "10." + (release - 4);
}

function getOsVersion() {
	let osName = os.type().replace("_", " ");
	let osVersion = os.release();

	if (osName === "Darwin") {
		osName = "macOS";
		osVersion = getMacOsVersion();
	}

	return osName + " " + osVersion;
}

function submitIssue(e: Error) {
	const versions = { app: app.getName(), electron: "Electron " + process.versions.electron, os: getOsVersion() };

	const url =
		"https://github.com/PenumbraProduction/lx_console_app/issues/new" +
		"?" +
		new URLSearchParams({
			title: `Error report for ${versions.app}`,
			body: "Error:\n```\n" + e.stack + "\n```\n" + `OS: ${versions.os}`
		}).toString();
	shell.openExternal(url).catch(log.error);
}

export function errorPopup(e: Error | string, explanation?: string, options?: { allowContinue: boolean }) {
	options = options ? options : { allowContinue: false };
	log.error(e);
	mainWindow.webContents.send("console.error", e);
	dialog
		.showMessageBox({
			title: explanation ? explanation : "An error occurred",
			message: typeof e == "string" ? e : e.message,
			detail: typeof e == "string" ? e : e.stack,
			type: "error",
			buttons: options.allowContinue ? ["Ignore", "Report", "Exit"] : ["Report", "Exit"]
		})
		.then((result) => {
			if (options.allowContinue) {
				if (result.response === 1) submitIssue(typeof e == "string" ? new Error(e) : e);
				if (result.response === 2) app.quit();
			} else {
				if (result.response === 0) submitIssue(typeof e == "string" ? new Error(e) : e);
				app.quit();
			}
		});
}

function executeJavascriptInRenderer(js: string): void {
	mainWindow.webContents.executeJavaScript(js + ";0").catch((e) => {
		errorPopup(e, "Error executing javascript in renderer process");
	});
}

const normalMenu = new Menu();
normalMenu.append(
	new MenuItem({
		label: "File",
		submenu: [
			{
				label: "Save Show",
				accelerator: "CmdOrCtrl+Shift+S",
				click: () => mainWindow.webContents.send("saveShow")
			},
			{
				type: "separator"
			},
			{
				label: "Restart",
				accelerator: "Alt+R",
				click: () => restart()
			},
			{
				label: "Exit",
				click: () => app.exit()
			}
		]
	})
);

normalMenu.append(
	new MenuItem({
		label: "View",
		submenu: [
			{
				label: "Toggle Sidebar",
				accelerator: "Alt+D",
				click: () => executeJavascriptInRenderer("renderer.toggleSidebar(null)")
			},
			{
				label: "Reset Sidebar Width",
				click: () => executeJavascriptInRenderer("renderer.resizeSidebar(275)")
			},
			{
				label: "Toggle CLI History",
				accelerator: "Alt+H",
				click: () => executeJavascriptInRenderer("renderer.toggleCommandHistory()")
			},
			{
				type: "separator"
			},
			{
				label: "Refresh Page",
				accelerator: "CmdOrCtrl+Shift+R",
				click: () => mainWindow.reload()
			},
			{
				label: "Toggle Developer Tools",
				accelerator: "CmdOrCtrl+Shift+I",
				click: () => mainWindow.webContents.toggleDevTools()
			}
		]
	})
);

normalMenu.append(
	new MenuItem({
		label: "Remote",
		submenu: [
			{
				label: "Update Fixture Library",
				// accelerator: "",
				click: () => updateProfileLibrary()
			},
			{
				type: "separator"
			},
			{
				label: "Connect External Interface",
				// accelerator: "",
				click: () => DmxManager.retrySerialportInit()
			},
			{
				label: "Disconnect External Interface",
				// accelerator: "",
				click: () => DmxManager.close()
			}
		]
	})
);

normalMenu.append(
	new MenuItem({
		label: "Tools",
		submenu: [{ label: "Profile Editor" }]
	})
);

// Add the "Toggle Menu Bar" option for linux users
if (process.platform === "linux") {
	normalMenu.items[1].submenu.append(
		new MenuItem({
			label: "Toggle Side Bar",
			click: () => {
				const current = mainWindow.isMenuBarVisible();
				mainWindow.setMenuBarVisibility(!current);
				mainWindow.webContents.send("prefsShowSideBar", !current);
			},
			accelerator: "Ctrl+M"
		})
	);
}

/*
    IPC Events
*/

ipcMain.on("errorPopup", (event, e: Error | string, explanation?: string, options?: { allowContinue: boolean }) => {
	errorPopup(e, explanation, options);
});

ipcMain.on("createPrompt", async (e, data) => {
	try {
		e.returnValue = await createPromptWindow(mainWindow, data.file, data.options, data.prefs);
	} catch (err) {
		e.returnValue = err;
	}
});

ipcMain.on("maximize", () => {
	mainWindow.maximize();
});

ipcMain.on("setMenuBarVisibility", (event, value: boolean) => {
	mainWindow.setMenuBarVisibility(value);
});

function restart() {
	app.relaunch();
	mainWindow.webContents.send("onClose");
}

ipcMain.on("restart", restart);

ipcMain.on("exit", async () => {
	await DmxManager.close();

	app.exit();
});

ipcMain.on("lock", () => {
	console.log("LOCK CONSOLE");
});

ipcMain.on("defaultDataDir", (event) => {
	event.returnValue = app.getPath("userData");
});

ipcMain.on("isWindowMaximized", (event) => {
	event.returnValue = mainWindow.isMaximized();
});

ipcMain.on("errorLoadingData", (e, text: string) => {
	mainWindow.destroy();

	const options: MessageBoxOptions = {
		type: "error",
		buttons: ["Ok"],
		defaultId: 0,
		cancelId: 0,
		detail: text.toString(),
		title: "Error",
		message: "Error while loading prefs/save data"
	};
	dialog.showMessageBoxSync(mainWindow, options);

	app.exit();
});
