import "../../css/prompt.scss";

import { PromptAPI } from "../main/prompt_preload";

type BridgedWindow = Window &
	typeof globalThis & {
		promptApi: any;
	};

export const api: PromptAPI = (window as BridgedWindow).promptApi.api;

interface PromptOptions {
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

let promptId:string = null;
let promptOptions: PromptOptions = null;

function promptError(error: Error | string) {
	if (error instanceof Error) error = error.message;
	api.ipcSendSync("prompt-error:" + promptId, error);
}

function promptCancel() {
	api.ipcSendSync("prompt-post-data:" + promptId, null);
}

function promptSubmit() {
	const dataElement = document.querySelector("#data") as HTMLInputElement;
	api.ipcSendSync("prompt-post-data:" + promptId, dataElement.value);
}

function promptCreateInput() {
	const dataElement = document.createElement("input");
	dataElement.setAttribute("type", promptOptions.inputType);

	if (promptOptions.defaultValue) {
		dataElement.value = promptOptions.defaultValue;
	} else {
		dataElement.value = "";
	}

	dataElement.addEventListener("keyup", (event) => {
		if (event.key === "Escape") {
			promptCancel();
		}
	});

	dataElement.addEventListener("keypress", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			(document.querySelector("#ok") as HTMLInputElement).click();
		}
	});

	return dataElement;
}

function promptRegister() {
	promptId = document.location.hash.replace("#", "");

	promptOptions = api.ipcSendSync("prompt-get-options:" + promptId);

	document.querySelector("#form").addEventListener("submit", promptSubmit);
	document.querySelector("#cancel").addEventListener("click", promptCancel);

    document.querySelector("#description").textContent = promptOptions.description;
    document.querySelector("#label").textContent = promptOptions.label;

	const dataContainerElement = document.querySelector("#data-container");

	const dataElement = promptCreateInput();

	dataContainerElement.append(dataElement);
	dataElement.setAttribute("id", "data");

	dataElement.focus();
    // dataElement.select();
}

window.addEventListener("error", (error) => {
	if (promptId) {
		promptError("An error has occurred on the prompt window: \n" + error);
	}
});

document.addEventListener("DOMContentLoaded", promptRegister);
