import {CueGroup, Cue, StackCue} from "./Cue";

export class Playback {
    id: number;
    name: string;
    length: number;
    cues: CueGroup[];

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;

        this.cues = [];
    }

    addCue(cue: CueGroup | StackCue) {
        //
    }
}