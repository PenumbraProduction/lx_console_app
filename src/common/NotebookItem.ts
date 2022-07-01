import { Serializable, JsonProperty } from "typescript-json-serializer";
import { v4 as GenerateUUID } from "uuid";

@Serializable()
export class TopLevelNotebookContainer {
	@JsonProperty()
	children: NotebookItemSkeleton[] = [];
	// array of core data for the children items
}

export enum NotebookItemSectionType {
	TEXT,
	MATHS
}

@Serializable()
export class NotebookItemSection {
	@JsonProperty()
	id: string;

	@JsonProperty()
	type: NotebookItemSectionType;

	source: string;

	constructor(type: NotebookItemSectionType) {
		this.type = type;
		this.id = GenerateUUID();
	}
}

@Serializable()
export class NotebookItemSkeleton {
	@JsonProperty()
	id: string;

	@JsonProperty()
	name: string;

	@JsonProperty({ required: false })
	fileName: string;

	@JsonProperty()
	children: NotebookItemSkeleton[] = [];
	// array of core data for the children items

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
export class NotebookItem {
	@JsonProperty()
	color = "#000000";

	@JsonProperty()
	icon = "book";

	@JsonProperty({ required: false })
	parentId = "";

	@JsonProperty({ required: false })
	favourite = false;

	@JsonProperty({ required: false })
	expanded = false;

	@JsonProperty({ required: true })
	skeleton: NotebookItemSkeleton = { id: "", name: "", fileName: "", children: [] };

	@JsonProperty()
	content: NotebookItemSection[] = [];

	constructor(name: string) {
		this.skeleton = new NotebookItemSkeleton(name);
	}

	toString() {
		return this.skeleton.id;
	}
}
