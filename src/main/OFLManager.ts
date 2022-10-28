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

/*
Copyright (C) 2022  Daniel Farquharson

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, version 3 (GPLv3)

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    See https://github.com/LordFarquhar/lx_console_app/blob/main/LICENSE an 
	implementation of GPLv3 (https://www.gnu.org/licenses/gpl-3.0.html)
*/

import * as fs from "fs";
import * as fsProm from "fs/promises";
import { app, ipcMain } from "electron";
import { downloadFile } from "./FileDownloader";
import * as path from "path";
import * as unzip from "unzip-stream";
import { Brand, Profile } from "lx_console_backend";
import { mainWindow } from "./main";
import { debounce } from "../common/util/time";

const defaultDataDir = app.getPath("userData");

export function uploadCustomProfile(filepath: string): Promise<void> {
	mainWindow.webContents.send("uploadingCustomProfile");
	isLoaded = false;
	return new Promise((resolve, reject) => {
		if (!fs.existsSync(path.join(defaultDataDir, "cfl")))
			fs.mkdirSync(path.join(defaultDataDir, "cfl"), { recursive: true });

		fsProm
			.readFile(filepath)
			.then((buff) => {
				// const data = JSON.parse(buff.toString());
				// ! Do structure checking

				const fileNameData = path.parse(filepath);
				if (fileNameData.ext !== ".json") reject("Invalid File Type");
				if (fileNameData.name.split(".")[1] !== "fixture") reject("Invalid Object Type");

				fsProm
					.writeFile(path.join(defaultDataDir, "cfl", fileNameData.base), buff)
					.then(() => {
						mainWindow.webContents.send("uploadingCustomProfileEnd");
						resolve();
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

export function updateProfileLibrary(): Promise<void> {
	mainWindow.webContents.send("updatingFixtureLibrary");
	isLoaded = false;
	return new Promise((resolve) => {
		if (!fs.existsSync(path.join(defaultDataDir, "temp", "ofldata")))
			fs.mkdirSync(path.join(defaultDataDir, "temp", "ofldata"), { recursive: true });

		downloadFile(
			"https://github.com/danielfar-theatretech/OpenFixtureLibrary/archive/refs/heads/main.zip",
			path.join(defaultDataDir, "temp", "ofldata", "data.zip"),
			(completedAmnt) => console.log(`${completedAmnt}% completed`)
		).then(() => {
			fs.createReadStream(path.join(defaultDataDir, "temp", "ofldata", "data.zip"))
				.pipe(unzip.Parse())
				.on("entry", function (entry) {
					const filePath: string = entry.path;
					const type = entry.type; // 'Directory' or 'File'
					// const size = entry.size; // might be undefined in some archives

					// console.log(filePath, type, size);

					if (filePath.startsWith("OpenFixtureLibrary-main/data/")) {
						const filePathExt = filePath.replace("OpenFixtureLibrary-main/data/", "");
						if (type === "Directory") {
							if (!fs.existsSync(path.join(defaultDataDir, "ofl", filePathExt)))
								fs.mkdirSync(path.join(defaultDataDir, "ofl", filePathExt), { recursive: true });
						} else {
							entry.pipe(fs.createWriteStream(path.join(defaultDataDir, "ofl", filePathExt)));
						}
					} else if (filePath == "OpenFixtureLibrary-main/map.json") {
						entry.pipe(fs.createWriteStream(path.join(defaultDataDir, "ofl_map.json")));
					} else {
						entry.autodrain();
					}
				})
				.on(
					"close",
					debounce(() => {
						fs.rmSync(path.join(defaultDataDir, "temp", "ofldata"), { recursive: true, force: true });
						mainWindow.webContents.send("updatingFixtureLibraryEnd");
						resolve();
					}, 200)
				);
		});
	});
}

let isLoaded = false;
const brands: Brand[] = [];
const fixtures: Profile[] = [];

type ChannelTypeMap = { [key: string]: string | null };
let ChannelTypeMappings: ChannelTypeMap = {};

export async function loadProfileLibrary(): Promise<void> {
	brands.length = 0;
	fixtures.length = 0;

	const baseDir = path.join(defaultDataDir, "ofl");
	if (!fs.existsSync(baseDir)) await updateProfileLibrary();

	const brandDirs: any[] = [];

	const fixtureContainerDirs: any[] = [];
	const fixtureDirs: any[] = [];

	(await fsProm.readdir(baseDir)).forEach((dir) =>
		dir.endsWith(".brand.json")
			? brandDirs.push(path.join(baseDir, dir))
			: fixtureContainerDirs.push(path.join(baseDir, dir))
	);

	await Promise.all(
		brandDirs.map(async (dir) => {
			const data = await fsProm.readFile(dir);
			brands.push(JSON.parse(data.toString()));
		})
	);

	await Promise.all(
		fixtureContainerDirs.map(async (fdir) =>
			(
				await fsProm.readdir(fdir)
			).forEach((dir) =>
				dir.endsWith(".fixture.json")
					? fixtureDirs.push(path.join(fdir, dir))
					: console.log(`Unknown Dir ${dir}`)
			)
		)
	);

	await Promise.all(
		fixtureDirs.map(async (dir) => {
			const data = await fsProm.readFile(dir);
			fixtures.push(JSON.parse(data.toString()));
		})
	);

	fixtures.sort((a, b) => (a.name > b.name ? 1 : -1));
	brands.sort((a, b) => (a.name > b.name ? 1 : -1));

	const map = await fsProm.readFile(path.join(defaultDataDir, "ofl_map.json"));
	ChannelTypeMappings = JSON.parse(map.toString());

	isLoaded = true;
}

export async function getBrandsList() {
	if (!isLoaded) await loadProfileLibrary();
	return brands;
}

export async function getFixturesList() {
	if (!isLoaded) await loadProfileLibrary();
	return fixtures;
}

export async function getFixturesByBrandId(brandId: string) {
	if (!isLoaded) await loadProfileLibrary();
	return fixtures.filter((fx) => fx.brand === brandId);
}

export async function getFixtureById(id: string) {
	if (!isLoaded) await loadProfileLibrary();
	return fixtures.find((fx) => fx.id === id);
}

export function getChannelTypeMappingForward(value: string) {
	return ChannelTypeMappings[value] ? ChannelTypeMappings[value] : "UNCATEGORISED";
}

export function getChannelTypeMappingBackward(value: string) {
	return Object.keys(ChannelTypeMappings).filter((key) => ChannelTypeMappings[key] === value);
}

export function getCategories() {
	return new Set(Object.values(ChannelTypeMappings));
}

export function getTypes() {
	return new Set(Object.keys(ChannelTypeMappings));
}

ipcMain.on("updateProfileLibrary", async () => await updateProfileLibrary());
ipcMain.on("loadProfileLibrary", async () => await loadProfileLibrary());

ipcMain.on("uploadCustomProfile", async (e, data) => await uploadCustomProfile(data));

ipcMain.on("getBrandsList", async (e) => (e.returnValue = await getBrandsList()));
ipcMain.on("getFixturesList", async (e) => (e.returnValue = await getFixturesList()));
ipcMain.on("getFixturesByBrandId", async (e, data) => (e.returnValue = await getFixturesByBrandId(data.brand)));
ipcMain.on("getFixtureById", async (e, data) => (e.returnValue = await getFixtureById(data.id)));

ipcMain.on("getChannelTypeMappings", (e) => (e.returnValue = ChannelTypeMappings));
