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

export function windowInstruction(instruction: string) {
	ipc.ipcSend("prompt-window-control:" + promptId, instruction);
}

export function submitText() {
	ipc.ipcSend("prompt-post-data:" + promptId, $("#textInput").val());
}
