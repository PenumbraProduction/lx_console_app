// import VERSION from "../version";
import { errorPopup, mainWindow } from "./main";

import { autoUpdater } from "electron-updater";
// import { compare } from "semver";
// import axios from "axios";

function ipcSend(channel: string, data?: any) {
	if (mainWindow?.webContents?.send) {
		mainWindow.webContents.send(channel, data);
	}
}

// https://medium.com/@johndyer24/creating-and-deploying-an-auto-updating-electron-app-for-mac-and-windows-using-electron-builder-6a3982c0cee6

export function startAutoUpdateChecker() {
	// if (!electron.app.isPackaged) {
	// 	autoUpdater.autoDownload = false;
	// 	autoUpdater.autoInstallOnAppQuit = false;
	// 	autoUpdater.forceDevUpdateConfig = true;
	// 	autoUpdater.checkForUpdates();
	// } else autoUpdater.checkForUpdatesAndNotify();

}

autoUpdater.on("checking-for-update", () => ipcSend("updateChecking"));
autoUpdater.on("update-not-available", () => ipcSend("updateNotAvailable"));
autoUpdater.on("update-available", (info) => ipcSend("updateAvailable", { version: info.version, date: info.releaseDate }));
autoUpdater.on("update-cancelled", () => ipcSend("updateCancelled"));
autoUpdater.on("download-progress", (info) => ipcSend("updateDownloadProgress", info));
autoUpdater.on("update-downloaded", () => ipcSend("updateDownloaded"));
autoUpdater.on("error", (e, m) => errorPopup(e, m ? m : "Error checking for updates"));

// export function checkForUpdates() {
// 	ipcSend("checkingForUpdates");
// 	axios({
// 		method: "GET",
// 		url: "https://api.github.com/repos/PenumbraProduction/lx_console_app/releases/latest"
// 	})
// 		.then((d) => {
// 			const { data } = d;
// 			if (data.prerelease) return ipcSend("noUpdateFound");
// 			if (compare(data.tag_name, VERSION)) {
// 				if (process.platform == "win32") return ipcSend("updateFound", { downloadUrl: data.zipball_url, body: data.body });
// 				else return ipcSend("updateFound", { downloadUrl: data.tarball_url, body: data.body });
// 			}
// 			return ipcSend("noUpdateFound");
// 		})
// 		.catch((e) => {
// 			errorPopup(e, "Error checking for updates using GitHub API", { allowContinue: true });
// 		});
// }
