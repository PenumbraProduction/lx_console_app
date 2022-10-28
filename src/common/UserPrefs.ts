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