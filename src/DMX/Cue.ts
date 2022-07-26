import { UniverseData } from "../types/Types";
import { Transition } from "./Transition";

export class Cue {
	id: number;
	name: string;
	channelData: UniverseData;

	constructor(id: number, name: string, channelData: UniverseData) {
		this.id = id;
		this.name = name;
		this.channelData = channelData;
	}
}

export class StackCue {
	referenceCueId: number;
	id: number;
	name: string;
	transition: Transition;

	constructor(id: number, name: string, referenceCueId: number, transition: Transition) {
		this.referenceCueId = referenceCueId;
		this.id = id;
		this.name = name;
		this.transition = transition;
	}
}

export class CueGroup {
	cues: Map<number, StackCue>;
	id: number;
	name: string;

	constructor(id: number, name: string, cues: StackCue[] | Map<number, StackCue>) {
		this.id = id;
		this.name = name;
		this.cues = Array.isArray(cues) ? new Map(cues.map((c) => [c.id, c])) : cues;
	}
}
