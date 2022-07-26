import { app, BrowserWindow, dialog, MessageBoxOptions, ipcMain, Menu, MenuItem, shell } from "electron";
import * as path from "path";
import * as remote from "@electron/remote/main";
import * as contextMenu from "electron-context-menu";

import * as Prompt from "./promptManager";

import * as DmxManager from "./dmxManager";

let mainWindow: BrowserWindow = null;
const gotTheLock = app.requestSingleInstanceLock();
let iconPath = "";

//FORCE SINGLE INSTANCE
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
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("activate", function () {
		// On OS X it"s common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
}

// Disable navigation
// https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation
app.on("web-contents-created", (event, contents) => {
	contents.on("will-navigate", (event) => {
		event.preventDefault();
	});
});

let splashWindow: BrowserWindow;

function createWindow() {
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
		// width: 1200,
		// height: 800,
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

	splashWindow.loadFile("html/splash.html");

	const splashWindowLoad = new Promise(function (resolve) {
		splashWindow.webContents.once("dom-ready", resolve);
	});

	splashWindow.on("show", () => {
		// splashWindow.setFocusable(true);
		splashWindow.focus();
		splashWindow.focusOnWebView();
	});
	splashWindow.webContents.once("dom-ready", () => {
		splashWindow.show();
	});

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

	// Enable @electron/remote in preload so we can
	// use the custom titlebar
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
		// await new Promise<void>((resolve) => setTimeout(resolve, 3 * 1000));

		updateSplashScreen("Trying to find interface through discovery...");

		let dmxPortName;
		try {
			const { path } = await DmxManager.findInterface();
			dmxPortName = path;
			updateSplashScreen(`Discovered interface on port ${dmxPortName}...`);
		} catch (e) {
			console.log(e);
			updateSplashScreen(e);
			// await new Promise<void>((resolve) => setTimeout(resolve, 3 * 1000));
		}

		if (!dmxPortName) {
			updateSplashScreen("Awaiting user input for interface port...");
			try {
				dmxPortName = await getUserInputInterfacePort();
			} catch (e) {
				updateSplashScreen(e);
			}
		}

		if (dmxPortName) {
			try {
				updateSplashScreen(`Attempting to connect to interface on port ${dmxPortName}...`);
				await DmxManager.init(dmxPortName);
			} catch (e) {
				console.log(e);
				updateSplashScreen(e);
				await new Promise((resolve) => setTimeout(resolve, 3 * 1000));
				app.quit(); // ! not quitting??
			}
		} else {
			updateSplashScreen("Could not find a port to use, continuing without DMX output");
		}

		mainWindow.show();
		splashWindow.close();
	});

	mainWindow.on("close", (e) => {
		e.preventDefault();
		mainWindow.webContents.send("onClose");
	});

	// register keyboard shortcuts

	// electron.globalShortcut.register("CommandOrControl+R", function() {
	// 	console.log("Refreshed Page");
	// 	mainWindow.reload();
	// });

	// Open the DevTools.
	//mainWindow.webContents.openDevTools();
}

function updateSplashScreen(text: string) {
	splashWindow.webContents.send("updateLoadingJob", text);
}

function getUserInputInterfacePort() {
	return new Promise<string>((resolve, reject) => {
		Prompt.prompt(
			{
				width: 500,
				height: 250,
				title: "Device Port",
				description: "Could not find interface port through discovery, please enter a port name to use",
				label: "Port Name",
				defaultValue: "COM9",
				icon: iconPath
			},
			splashWindow
		)
			.catch((e: Error) => errorPopup(e.name, e.message))
			.then(async (response) => {
				response = response as Array<string>;
				if (!response.length || response[0] == null) {
					reject("No valid User Input");
				}

				// todo: portName checking, make sure it is a valid USB path
				return resolve(response[0]);
			});
	});
}

function errorPopup(mes: string, det: string) {
	const options: MessageBoxOptions = {
		type: "error",
		buttons: ["Ok"],
		defaultId: 0,
		cancelId: 0,
		detail: det,
		title: "Error",
		message: mes
	};
	dialog.showMessageBox(mainWindow, options);

	mainWindow.webContents.send("console.error", `${mes}\n${det}`);
}

function executeJavascriptInRenderer(js: string): void {
	mainWindow.webContents.executeJavaScript(js + ";0").catch((reason) => {
		errorPopup("Error executing javascript in renderer process", reason.toString());
	});
}

function openAboutWindow(): void {
	const about = new BrowserWindow({
		width: 680,
		height: 450,
		resizable: false,
		webPreferences: {
			preload: __dirname + "/about_preload.js"
		},
		icon: path.join(__dirname, iconPath),
		title: "About LX Console",
		parent: mainWindow,
		modal: process.platform === "darwin" ? false : true,
		show: false
	});
	about.webContents.once("dom-ready", () => {
		about.show();
	});
	about.setMenu(null);
	about.loadFile("html/about.html");
}

const normalMenu = new Menu();
normalMenu.append(
	new MenuItem({
		label: "File",
		submenu: [
			// {
			// 	label: "New Notebook",
			// 	accelerator: "CmdOrCtrl+N",
			// 	click: () => mainWindow.webContents.send("newNotebook")
			// },
			{
				type: "separator"
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
				accelerator: "Alt+R",
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
		label: "Help",
		submenu: [
			{
				label: "Help",
				accelerator: "F1",
				click: () => shell.openExternal("")
			},
			{
				label: "Website",
				click: () => shell.openExternal("")
			},
			{
				label: "What's New",
				click: () => mainWindow.webContents.send("whatsNew")
			},
			{
				label: "All Changelogs",
				click: () => shell.openExternal("")
			},
			{
				label: "Give Feedback (Google Forms)",
				click: () => shell.openExternal("")
			},
			{
				type: "separator"
			},
			{
				label: "About",
				click: () => openAboutWindow()
			}
		]
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

ipcMain.on("errorPopup", (event, args: string[]) => {
	errorPopup(args[0], args[1]);
});

ipcMain.on("maximize", () => {
	mainWindow.maximize();
});

ipcMain.on("setMenuBarVisibility", (event, value: boolean) => {
	mainWindow.setMenuBarVisibility(value);
});

ipcMain.on("restart", () => {
	app.relaunch();
	mainWindow.webContents.send("onClose");
});

ipcMain.on("exit", async () => {
	// todo some form of closing screen so user cannot interact with main window
	await DmxManager.exit();

	app.exit();
});

ipcMain.on("defaultDataDir", (event) => {
	event.returnValue = app.getPath("userData");
});

ipcMain.on("isWindowMaximized", (event) => {
	event.returnValue = mainWindow.isMaximized();
});

ipcMain.on("openAboutWindow", () => {
	openAboutWindow();
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

ipcMain.on("changeSaveLocation", (e) => {
	const filepaths = dialog.showOpenDialogSync(mainWindow, {
		properties: ["openDirectory"]
	});

	if (filepaths !== undefined) {
		e.returnValue = filepaths[0];
	} else {
		e.returnValue = "";
	}
});

// ---------- //
// DMX Stuffs //
// ---------- //

DmxManager.universe.on("bufferUpdate", () =>
	mainWindow.webContents.send("universeBufferUpdate", Array.from(DmxManager.universe.getUniverseBuffer()).slice(1))
);
DmxManager.events.on("updatePatch", () => mainWindow.webContents.send("updatePatch", DmxManager.getPatchData()));
DmxManager.events.on("groupsUpdate", () => mainWindow.webContents.send("groupsUpdate", DmxManager.getGroups()));
DmxManager.events.on("cuesUpdate", () => mainWindow.webContents.send("cuesUpdate", DmxManager.getCues()));

ipcMain.on("getUniverseData", (e) => (e.returnValue = DmxManager.universe.getUniverseBuffer()));

ipcMain.on("updateUniverseIndividual", (e, d) => e.returnValue = DmxManager.universe.update(d[0].channel, d[0].value))
ipcMain.on("updateUniverseEach", (e, d) => e.returnValue = DmxManager.universe.updateEach(d[0]));
ipcMain.on("updateUniverseSelect", (e, d) => e.returnValue = DmxManager.universe.updateSelect(d[0].channels, d[0].value));
ipcMain.on("updateChannelsSelect", (e, d) => e.returnValue = DmxManager.updateChannelsSelect(d[0]));

ipcMain.on(
	"findProfileByName",
	(e, d) => (e.returnValue = DmxManager.findProfileByName(d[0].brand, d[0].name))
);
ipcMain.on("findProfileById", (e, d) => (e.returnValue = DmxManager.findProfileById(d[0])));
ipcMain.on("getFixtureLibrary", (e) => (e.returnValue = DmxManager.fixtureLibrary));
ipcMain.on("getFixtureLibraryBrands", (e) => (e.returnValue = DmxManager.getFixtureLibraryBrands()));
ipcMain.on("getFixtureLibraryNames", (e, d) => (e.returnValue = DmxManager.getFixtureLibraryNames(d[0])));

ipcMain.on("patchFixture", (e, d) => (e.returnValue = DmxManager.patchFixture(d[0])));
ipcMain.on("patchFixtures", (e, d) => (e.returnValue = DmxManager.patchFixtures(d[0])));
ipcMain.on("unpatchFixtures", (e, d) => (e.returnValue = DmxManager.unpatchFixtures(d[0])));
ipcMain.on("getPatchData", (e) => (e.returnValue = DmxManager.getPatchData()));
ipcMain.on("renameChannel", (e, d) => (e.returnValue = DmxManager.renameChannel(d[0].channel, d[0].name)));

ipcMain.on("getGroups", (e) => (e.returnValue = DmxManager.getGroups()));
ipcMain.on("getGroup", (e, d) => (e.returnValue = DmxManager.getGroup(d[0])));
ipcMain.on("setGroup", (e, d) => (e.returnValue = DmxManager.setGroup(d[0])));

ipcMain.on("getCues", (e) => (e.returnValue = DmxManager.getCues()));
ipcMain.on("setCue", (e, d) => (e.returnValue = DmxManager.setCue(d[0])));
ipcMain.on("getCue", (e, d) => (e.returnValue = DmxManager.getCue(d[0])));
