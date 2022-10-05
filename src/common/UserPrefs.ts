import { JsonObject, JsonProperty } from "typescript-json-serializer";

@JsonObject()
export class UserPrefs {
    @JsonProperty()
    lastUseVersion = "0.0.0";

    @JsonProperty()
    mainBgColor = "#252525";
    @JsonProperty()
    mainFgColor = "#c4c4c4";
    @JsonProperty()
    accentBgColor = "#FF7A27";
    @JsonProperty()
    accentFgColor = "#aeaeae";

    @JsonProperty()
    defaultMaximized = false;
    
    @JsonProperty()
    showSideBar = true;

    @JsonProperty()
    sidebarWidth = 275;

    @JsonProperty()
    commandLineHistoryCount = 8;
}