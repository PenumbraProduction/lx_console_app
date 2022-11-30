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

import { DeskSaveData } from "lx_console_backend";
import { JsonObject, JsonProperty } from "typescript-json-serializer";
import { v4 as GenerateUUID } from "uuid";
import moment from "moment";
import VERSION from "../version";

// TODO: attribute palettes
// TODO: groups
// TODO: Cues
// TODO: Cue stacks / playbacks

// @JsonObject()
// export class ShowPatchChannel {
// 	@JsonProperty()
// 	ch: number;

// 	@JsonProperty()
// 	profile: string;

// 	@JsonProperty()
// 	profileOptions: ProfileOptions;

// 	@JsonProperty()
// 	addressRange: DmxAddressRange;

// 	constructor(ch: number, profile: string, profileOptions: ProfileOptions, addressRange: DmxAddressRange) {
// 		this.ch = ch;
// 		this.profile = profile;
// 		this.profileOptions = profileOptions;
// 		this.addressRange = addressRange;
// 	}
// }

// @JsonObject()
// export class ShowPatch {
// 	@JsonProperty()
// 	channels: Array<ShowPatchChannel>;

// 	constructor() {
// 		this.channels = [];
// 	}
// }

@JsonObject()
export class ShowSkeleton {
	@JsonProperty()
	id: string;

	@JsonProperty()
	name: string;

	@JsonProperty()
	fileName: string;

	@JsonProperty()
	lastModified: number;

	version: string;

	constructor(name: string) {
		this.name = name;
		this.id = GenerateUUID();
		this.fileName = this.id + ".lxshow";
		this.lastModified = moment.now();
		this.version = VERSION;
	}

	toString() {
		return this.id;
	}
}

@JsonObject()
export class ShowData {
	@JsonProperty()
	skeleton: ShowSkeleton;

	@JsonProperty()
	desk: DeskSaveData;

	constructor(name: string) {
		this.skeleton = new ShowSkeleton(name);
	}

	toString() {
		return this.skeleton.id;
	}
}

export function generateShowData(skeleton: ShowSkeleton, deskSave: DeskSaveData): ShowData {
	const sd = new ShowData("");
	sd.skeleton = skeleton;
	sd.desk = deskSave;
	return sd;
}