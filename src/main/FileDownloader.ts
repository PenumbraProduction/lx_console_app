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

import axios from "axios";
import { createWriteStream } from "fs";

export type ProgressCallback = (percentComplete: number) => void;

export async function downloadFile(srcFile: string, outFile: string, progressCB?: ProgressCallback) {
	const writer = createWriteStream(outFile);

	const response = await axios({
		method: "get",
		url: srcFile,
		responseType: "stream",
		onDownloadProgress: (progressEvent) => {
			const percentCompleted = Math.floor((progressEvent.loaded / progressEvent.total) * 100);
			if (progressCB) {
				progressCB(percentCompleted);
			}
		}
	});
	return await new Promise((resolve, reject) => {
		response.data.pipe(writer);
		let error: Error = null;
		writer.on("error", (err) => {
			error = err;
			writer.close();
			reject(err);
		});
		writer.on("close", () => {
			if (!error) resolve(true);
		});
	});
}
