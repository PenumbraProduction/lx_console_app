import { Serializable, JsonProperty } from "typescript-json-serializer";
import { v4 as GenerateUUID } from "uuid";

@Serializable()
export class ShowPatch {
	
}

@Serializable()
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

@Serializable()
export class ShowData {
	@JsonProperty({ required: true })
	skeleton: ShowSkeleton = { id: "", name: "", fileName: "" };

	@JsonProperty()
	patch: ShowPatch = [];

	constructor(name: string) {
		this.skeleton = new ShowSkeleton(name);
	}

	toString() {
		return this.skeleton.id;
	}
}
