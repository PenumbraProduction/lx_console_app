import { Serializable, JsonProperty } from "typescript-json-serializer";

@Serializable()
export class UserPrefs {
    @JsonProperty()
    lastUseVersion = "0.0.0";

    @JsonProperty()
    accentColor = "#FF7A27";

    @JsonProperty()
    defaultMaximized = false;
    
    @JsonProperty()
    showSideBar = true;

    @JsonProperty()
    sidebarWidth = 275;

    @JsonProperty()
    commandLineHistoryCount = 8;
}