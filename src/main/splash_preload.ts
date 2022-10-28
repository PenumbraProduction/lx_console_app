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

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

export type SplashAPI = {
	ipcHandle(channel: string, listener: (event: any, ...args: any[]) => void): void;
	ipcSend(channel: string, ...args: any[]): void;
	ipcSendSync(channel: string, ...args: any[]): any;
};

const api: SplashAPI = {
	ipcHandle: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
		ipcRenderer.on(channel, listener);
	},

	ipcSend: (channel: string, ...args: any[]): void => {
		ipcRenderer.send(channel, ...args);
	},

	ipcSendSync: (channel: string, ...args: any[]): any => {
		return ipcRenderer.sendSync(channel, ...args);
	}
};

contextBridge.exposeInMainWorld("splashApi", {
	api: api
});
