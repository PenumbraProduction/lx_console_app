import { v4 } from "uuid";
import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import * as remote from "@electron/remote/main";

export const createPromptWindow = (parent: BrowserWindow, file: string, options: any) =>
	new Promise((resolve, reject) => {
		const id = v4();
		let window = new BrowserWindow({
			parent,
			modal: true,
			show: false,
			webPreferences: {
				preload: __dirname + "/prompts/prompt_preload.js"
			},
			frame: false,
			alwaysOnTop: false
		});

		window.setMenu(null);
		window.setMenuBarVisibility(false);
		// window.setAlwaysOnTop(true, "modal-panel");
		remote.enable(window.webContents);

		const getOptionsListener = (e: IpcMainEvent) => {
			e.returnValue = options;
		};

		const postDataListener = (e: IpcMainEvent, data: any) => {
			cleanup();
			resolve(data);
		};

		const errorListener = (e: IpcMainEvent, err: Error) => {
			cleanup();
			reject(err);
		};

		const windowControlListener = (e: IpcMainEvent, instruction: string) => {
			if (instruction == "close") {
				cleanup();
			}
		};

		const cleanup = () => {
			ipcMain.removeListener("prompt-get-options:" + id, getOptionsListener);
			ipcMain.removeListener("prompt-post-data:" + id, postDataListener);
			ipcMain.removeListener("prompt-error:" + id, errorListener);
			ipcMain.removeListener("prompt-window-control:" + id, windowControlListener);

			if (window) {
				window.close();
				window = null;
			}
		};

		ipcMain.on("prompt-get-options:" + id, getOptionsListener);
		ipcMain.on("prompt-post-data:" + id, postDataListener);
		ipcMain.on("prompt-error:" + id, errorListener);
		ipcMain.on("prompt-window-control:" + id, windowControlListener);

		window.once("ready-to-show", () => {
			window.show();
		});

		window.once("closed", () => {
			window = null;
			cleanup();
			resolve(null);
		});

		window.loadFile("html/prompts/" + file + ".html", { hash: id });
	});
