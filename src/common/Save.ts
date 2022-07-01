import { Serializable, JsonProperty } from "typescript-json-serializer";
import { TopLevelNotebookContainer } from "./NotebookItem";

@Serializable()
export class Save {
    @JsonProperty()
    pages: TopLevelNotebookContainer;

    @JsonProperty()
    version = "1.0.0"; // VERSION CHANGE NOTICE
}