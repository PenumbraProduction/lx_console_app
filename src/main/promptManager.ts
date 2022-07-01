import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import * as remote from "@electron/remote/main";
import path = require("path");

export interface PromptOptions {
	width: number;
	height: number;
	title: string;
	description: string;
	icon: string;
	alwaysOnTop?: boolean;

	label: string;
	inputType?:
		| "button"
		| "checkbox"
		| "color"
		| "date"
		| "datetime-local"
		| "email"
		| "file"
		| "hidden"
		| "image"
		| "month"
		| "number"
		| "password"
		| "range"
		| "search"
		| "tel"
		| "text"
		| "time"
		| "url"
		| "week";
	defaultValue?: string;
}

export function prompt(options: PromptOptions, parentWindow?: BrowserWindow) {
	return new Promise<Array<string>>((resolve, reject) => {
		const id = `${Date.now()}-${Math.random()}`;
        console.log(`Created Prompt with ID: ${id}`);

		let promptWindow = new BrowserWindow({
			width: options.width,
			height: options.height,
			minWidth: options.width,
			minHeight: options.height,
			resizable: false,
			minimizable: false,
			fullscreenable: false,
			maximizable: false,
			show: false,
			parent: parentWindow,
			skipTaskbar: true,
			alwaysOnTop: options.alwaysOnTop,
			modal: parentWindow ? true : false,
			title: options.title,
			icon:  path.join(__dirname, options.icon) || undefined,
			webPreferences: {
				preload: __dirname + "/prompt_preload.js"
			}
		});

		remote.enable(promptWindow.webContents);

		promptWindow.setMenu(null);
		promptWindow.setMenuBarVisibility(false);

		const cleanup = () => {
			console.log(`Prompt cleanup and close, ID: ${id}`);
			ipcMain.removeListener("prompt-get-options:" + id, getOptionsListener);
			ipcMain.removeListener("prompt-post-data:" + id, postDataListener);
			ipcMain.removeListener("prompt-error:" + id, errorListener);

			if (promptWindow) {
				promptWindow.close();
				promptWindow = null;
			}
		};

		const getOptionsListener = (event: IpcMainEvent) => {
			event.returnValue = options;
		};

		const postDataListener = (event: IpcMainEvent, value: Array<string>) => {
			resolve(value);
			event.returnValue = null;
			cleanup();
		};

		const unresponsiveListener = () => {
			reject(new Error("Window was unresponsive"));
			cleanup();
		};

		const errorListener = (event: IpcMainEvent, message: string) => {
			reject(new Error(message));
			event.returnValue = null;
			cleanup();
		};

		ipcMain.on("prompt-get-options:" + id, getOptionsListener);
		ipcMain.on("prompt-post-data:" + id, postDataListener);
		ipcMain.on("prompt-error:" + id, errorListener);
		promptWindow.on("unresponsive", unresponsiveListener);

		promptWindow.on("closed", () => {
			promptWindow = null;
			cleanup();
			resolve([]);
		});

		promptWindow.once("ready-to-show", () => {
			promptWindow.show();
		});

		promptWindow.loadFile("html/prompt.html", { hash: id });
	});
}
