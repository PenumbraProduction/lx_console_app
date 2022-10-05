import { JsonObject, JsonProperty } from "typescript-json-serializer";
import { ShowData } from "./ShowFile";

@JsonObject()
export class Save {
    @JsonProperty()
    shows: ShowData[];

    @JsonProperty()
    version = "1.0.0"; // VERSION CHANGE NOTICE
}