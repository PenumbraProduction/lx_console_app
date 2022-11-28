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

import "../../../css/style.scss";

import { PromptIpc } from "../../main/prompts/prompt_preload";

type BridgedWindow = Window &
	typeof globalThis & {
		promptIpc: any;
	};

export const ipc: PromptIpc = (window as BridgedWindow).promptIpc;

const promptId = document.location.hash.replace("#", "");
const options = ipc.ipcSendSync("prompt-get-options:" + promptId);

console.log(options);

if(options.prompt) {
	$("#customTitle").text(options.prompt);
}

export function windowInstruction(instruction: string) {
	ipc.ipcSend("prompt-window-control:" + promptId, instruction);
}

export function submitText() {
	ipc.ipcSend("prompt-post-data:" + promptId, $("#textInput").val());
}
