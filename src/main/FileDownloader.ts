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
