import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

export type PromptIpc = {
	ipcHandle(channel: string, listener: (event: any, ...args: any[]) => void): void;
	ipcSend(channel: string, ...args: any[]): void;
	ipcSendSync(channel: string, ...args: any[]): any;
};

const ipc: PromptIpc = {
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

contextBridge.exposeInMainWorld("promptIpc", ipc);
