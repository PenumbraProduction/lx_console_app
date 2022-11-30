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

import fs from "fs";
import { app, ipcMain } from "electron";
import { compare } from "semver";
import { JsonSerializer, throwError } from "typescript-json-serializer";
const jsonSerializer = new JsonSerializer({
	errorCallback: throwError,
	nullishPolicy: {
		undefined: "allow",
		null: "allow"
	}
});
import { errorPopup } from "./main";
import { UserPrefs } from "../common/UserPrefs";

import VERSION from "../version";

const defaultSaveLocation = app.getPath("userData");

let canSavePrefs = false;
let prefs: UserPrefs = null;

let showFirstUse = false;
let showWhatsNew = false;

export function loadPrefs() {
	if (fs.existsSync(defaultSaveLocation + "/prefs.json")) {
		try {
			const json = fs.readFileSync(defaultSaveLocation + "/prefs.json", "utf-8").toString();
			prefs = jsonSerializer.deserializeObject<UserPrefs>(json, UserPrefs);

			canSavePrefs = true;
		} catch (err) {
			errorPopup(
				"errorLoadingData",
				`Your prefs.json file in '${defaultSaveLocation}' could not be parsed. Check the prefs.json file for issues or try deleting it.\n\n${err}`,
				{ allowContinue: false }
			);
		}
	} else {
		prefs = new UserPrefs();
		// saveLocation = defaultSaveLocation;
		canSavePrefs = true;
		savePrefs(prefs);

		showFirstUse = true;
	}

	if (compare(VERSION, prefs.lastUseVersion) == 1) {
		showWhatsNew = true;
		prefs.lastUseVersion = VERSION;
	}
}

export function getPrefs(): UserPrefs {
	return jsonSerializer.deserializeObject<UserPrefs>(JSON.stringify(prefs), UserPrefs);
}

export function savePrefs(prefsObj: UserPrefs): void {
	if (canSavePrefs == true) {
		prefs = prefsObj;
		fs.writeFileSync(defaultSaveLocation + "/prefs.json", JSON.stringify(prefs, null, 4), "utf-8");
		fs.writeFileSync(defaultSaveLocation + "/prefs.json", JSON.stringify(jsonSerializer.serializeObject(prefs), null, 4), "utf-8");
	}
}

ipcMain.on("getPrefs", (e) => (e.returnValue = getPrefs()));
ipcMain.on("savePrefs", (e, prefs) => savePrefs(prefs));

ipcMain.on("getShowFirstUse", (e) => (e.returnValue = showFirstUse));
ipcMain.on("getShowWhatsNew", (e) => (e.returnValue = showWhatsNew));
