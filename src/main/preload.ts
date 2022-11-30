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

import { contextBridge, ipcRenderer, IpcRendererEvent, clipboard } from "electron";
import * as util from "util";
import * as remote from "@electron/remote";
import { Titlebar, Color } from "@treverix/custom-electron-titlebar";

export type MainAPI = {
	ipcHandle(channel: string, listener: (event: any, ...args: any[]) => void): void;
	ipcSend(channel: string, ...args: any[]): void;
	ipcSendSync(channel: string, ...args: any[]): any;

	writeClipboard(text: string): void;
	readClipboard(): string;

	inspect(obj:string): string;
};

const api: MainAPI = {
	ipcHandle: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
		ipcRenderer.on(channel, listener);
	},

	ipcSend: (channel: string, ...args: any[]): void => {
		ipcRenderer.send(channel, ...args);
	},

	ipcSendSync: (channel: string, ...args: any[]): any => {
		return ipcRenderer.sendSync(channel, ...args);
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
