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

import { DmxAddressRange, ProfileOptions } from "lx_console_backend";
import { JsonObject, JsonProperty } from "typescript-json-serializer";
import { v4 as GenerateUUID } from "uuid";

// TODO: attribute palettes
// TODO: groups
// TODO: Cues
// TODO: Cue stacks / playbacks

@JsonObject()
export class ShowPatchChannel {
	@JsonProperty()
	ch: number;

	@JsonProperty()
	profile: string;

	@JsonProperty()
	profileOptions: ProfileOptions;

	@JsonProperty()
	addressRange: DmxAddressRange;
}

@JsonObject()
export class ShowPatch {
	@JsonProperty()
	channels: Array<ShowPatchChannel>;
}

@JsonObject()
export class ShowSkeleton {
	@JsonProperty()
	id: string;

	@JsonProperty()
	name: string;

	@JsonProperty({ required: false })
	fileName: string;

	constructor(name: string) {
		this.name = name;
		this.id = GenerateUUID();
		this.fileName = this.id + ".json";
	}

	toString() {
		return this.id;
	}
}

@JsonObject()
export class ShowData {
	@JsonProperty({ required: true })
	skeleton: ShowSkeleton = { id: "", name: "", fileName: "" };

	@JsonProperty()
	patch: ShowPatch;

	constructor(name: string) {
		this.skeleton = new ShowSkeleton(name);
	}

	toString() {
		return this.skeleton.id;
	}
}
