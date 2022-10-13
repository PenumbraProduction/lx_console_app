import { EventEmitter } from "events";
import { ContentHistory, ContentHistoryOptions } from "./ContentHistory";

export const ModifierKey = {
	CONTROL: "Control",
	SHIFT: "Shift",
	ALT: "Alt"
};

export const MetaKey = {
	UNIDENTIFIED: "Unidentified",
	META: "Meta"
};

export const ArrowKey = {
	ARROW_LEFT: "ArrowLeft",
	ARROW_RIGHT: "ArrowRight",
	ARROW_UP: "ArrowUp",
	ARROW_DOWN: "ArrowDown"
};

export const ControlKey = {
	ENTER: "Enter",
	SPACE: " ",
	BACKSPACE: "Backspace",
	DELETE: "Delete",
	ESCAPE: "Escape",
	TAB: "Tab",
	PAGE_UP: "PageUp",
	PAGE_DOWN: "PageDown"
};

export const NumericalKey = {
	ZERO: "0",
	ONE: "1",
	TWO: "2",
	THREE: "3",
	FOUR: "4",
	FIVE: "5",
	SIX: "6",
	SEVEN: "7",
	EIGHT: "8",
	NINE: "9"
};

export const AlphabeticalKey = {
	A: "a",
	B: "b",
	C: "c",
	D: "d",
	E: "e",
	F: "f",
	G: "g",
	H: "h",
	I: "i",
	J: "j",
	K: "k",
	L: "l",
	M: "m",
	N: "n",
	O: "o",
	P: "p",
	Q: "q",
	R: "r",
	S: "s",
	T: "t",
	U: "u",
	V: "v",
	W: "w",
	X: "x",
	Y: "y",
	Z: "z",
	UPPER_A: "A",
	UPPER_B: "B",
	UPPER_C: "C",
	UPPER_D: "D",
	UPPER_E: "E",
	UPPER_F: "F",
	UPPER_G: "G",
	UPPER_H: "H",
	UPPER_I: "I",
	UPPER_J: "J",
	UPPER_K: "K",
	UPPER_L: "L",
	UPPER_M: "M",
	UPPER_N: "N",
	UPPER_O: "O",
	UPPER_P: "P",
	UPPER_Q: "Q",
	UPPER_R: "R",
	UPPER_S: "S",
	UPPER_T: "T",
	UPPER_U: "U",
	UPPER_V: "V",
	UPPER_W: "W",
	UPPER_X: "X",
	UPPER_Y: "Y",
	UPPER_Z: "Z"
};

export const Key = { ...AlphabeticalKey, ...NumericalKey, ...ControlKey, ...ArrowKey, ...ModifierKey, ...MetaKey };
export type Key = typeof Key;

export type ExecFunction = (tokens: string[]) => boolean;

export type CommandLineOptions = {
	contentHistoryOptions: ContentHistoryOptions;
};

export class CommandLine extends EventEmitter {
	tokens: any[];
	tokenParts: any[];
	modifierKeys: Set<string>;
	execFunc: ExecFunction;
	history: ContentHistory;

	constructor(options: CommandLineOptions) {
		super();

		this.tokens = [];
		this.tokenParts = [];

		this.history = new ContentHistory({ maxLength: options.contentHistoryOptions.maxLength });

		this.modifierKeys = new Set();
		this.execFunc = () => false;
	}

	setExecFunc(func: ExecFunction) {
		this.execFunc = func;
	}

	exec() {
		this.addToken();
		if (!this.execFunc(this.tokens)) return;
		this.history.push(this.tokens);
		this.emit("historyUpdate");
		this.tokens = [];
		this.tokenParts = [];
		this.emit("tokenUpdate");
	}

	execImmediately(tokens: string[]) {
		if (!this.execFunc(tokens)) return;
		this.history.push(tokens);
		this.emit("historyUpdate");
	}

	optionalAddToken(token: string) {
		this.addToken();
		if(this.tokens[this.tokens.length - 1] == token) return;
		this.addToken(token);
	}

	addToken(token?: string) {
		const tokenFromParts = this.buildTokenFromParts();
		if (tokenFromParts) this.tokens.push(tokenFromParts);
		if (token) this.tokens.push(token);
		this.emit("tokenUpdate");
	}

	addTokenPart(tokenPart?: string) {
		if (tokenPart) this.tokenParts.push(tokenPart);
		this.emit("tokenUpdate");
	}

	setTokens(tokens: Array<string>, tokenParts?: Array<string>) {
		this.tokens = tokens;
		this.tokenParts = tokenParts || [];
		this.emit("tokenUpdate");
	}

	buildTokenFromParts(): string {
		const token = this.tokenParts.join("");
		this.tokenParts = [];
		this.emit("tokenUpdate");
		return token;
	}

	clear() {
		this.tokenParts = [];
		this.tokens = [];
		this.emit("tokenUpdate");
	}

	backspace() {
		if (this.tokenParts.length) this.tokenParts.pop();
		else this.tokens.pop();
		this.emit("tokenUpdate");
	}
}
