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

import { v4 } from "uuid";
import { BrowserWindow, ipcMain, IpcMainEvent, screen } from "electron";
import * as remote from "@electron/remote/main";
import { UserPrefs } from "../common/UserPrefs";

export const createPromptWindow = (parent: BrowserWindow, file: string, options: any, prefs?: UserPrefs) =>
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

		const cursorScreenPoint = screen.getCursorScreenPoint();
		const screenToUse = screen.getDisplayNearestPoint(cursorScreenPoint);
		window.setBounds({
			x: screenToUse.bounds.x,
			y: screenToUse.bounds.y,
			width: screenToUse.workAreaSize.width * (3 / 4),
			height: screenToUse.workAreaSize.height * (3 / 4)
		});
		window.center();

		window.setMenu(null);
		window.setMenuBarVisibility(false);
		// window.setAlwaysOnTop(true, "modal-panel");
		remote.enable(window.webContents);

		window.webContents.on("before-input-event", (e, input) => {
			if (input.key == "Escape") {
				cleanup();
			}
		});

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

		// window.webContents.on("did-finish-load", async () => {
		// 	console.log("DID FINISH LOAD")
		// 	const result = await window.webContents.insertCSS(
		// 		`
		// 	body {
		// 		background-color: red;
		// 	}
		// 	`
		// 	)
		// 	.catch((error) => {
		// 		console.log(error);
		// 	});
		// 	console.log("CSS Added Successfully");
		// 	console.log("Unique Key Returned ", result);
		// })

		window.webContents.on("did-finish-load", () => {
			window.webContents.insertCSS(':root { --temp-var: #f00; }')

			if(prefs) {
				window.webContents.insertCSS(`
				body {
					background-color: red;
				}
				:root {
					--accent-bg: ${prefs.accentBgColor} !important;
					--accent-fg: ${prefs.accentFgColor} !important;
					--main-bg: ${prefs.mainBgColor} !important;
					--main-fg: ${prefs.mainFgColor} !important;
				}
				`)
			}
		});

		window.once("ready-to-show", async () => {
			window.show();
		});

		window.once("closed", () => {
			window = null;
			cleanup();
			resolve(null);
		});

		window.loadFile("html/prompts/" + file + ".html", { hash: id });
	});
