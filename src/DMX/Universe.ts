import { EventEmitter } from "events";
import * as SerialPort from "serialport";
import { wait } from "./util/time";
import { UniverseData } from "../types/Types";

// let frame = 0;
// let time = 0;
// let prevTime = 0;

export interface IUniverseDriver extends EventEmitter {
	init(serialPortName: string): Promise<void>;

	get(channel: number): number;

	update(channel: number, value: number): void;
	updateSelect(channels: Array<number>, val: number): void;
	updateEach(channels: UniverseData): void;
	updateAll(value: number): void;

	close(): Promise<void> | void;
}

export class Universe extends EventEmitter implements IUniverseDriver {
	private readonly _universeBuffer: Buffer;

	private _readyToWrite: boolean;
	private _serialPort!: SerialPort.SerialPort;
	private _serialPortName: string;

	private readonly _sendInterval: number;
	private _intervalHandle: any | undefined = undefined;

	constructor() {
		super();

		this._universeBuffer = Buffer.alloc(513);

		this._readyToWrite = false;

		this._sendInterval = 44;
	}

	getUniverseBuffer(): Buffer {
		// ? is this inefficient? Could I not just send whatever value is in index 0 without any effect?
		return Buffer.concat([Buffer.from([0]), this._universeBuffer.slice(1)]);
	}

	init(serialPortName: string): Promise<void> {
		this._serialPortName = serialPortName;

		return new Promise((resolve, reject) => {
			this._serialPort = new SerialPort.SerialPort(
				{
					path: this._serialPortName,
					baudRate: 250000,
					dataBits: 8,
					stopBits: 2,
					parity: "none"
				},
				(err) => {
					if (!err) {
						this._readyToWrite = true;
						this.start();
						resolve();
					} else {
						reject(err);
					}
				}
			);
			this._serialPort.on("close", () => {
				console.log("SerialPort Closed");
			});
			this._serialPort.on("end", () => {
				console.log("SerialPort Ended");
			});
			this._serialPort.on("error", (e) => {
				console.log("SerialPort Error");
				console.error(e);
			});
		});
	}

	start(): void {
		if (this._intervalHandle !== undefined) {
			throw new Error("Driver is already running.");
		}
		this._intervalHandle = setInterval(this.sendUniverse.bind(this), this._sendInterval);
	}

	stop(): void {
		if (this._intervalHandle !== undefined) {
			clearInterval(this._intervalHandle);
			this._intervalHandle = undefined;
		}
	}

	close(): Promise<void> {
		this.stop();
		return new Promise((resolve, reject) => this._serialPort.close((err: any) => (err ? reject(err) : resolve())));
	}

	async sendUniverse(): Promise<void> {
		// frame++;
		// if (frame % 60 == 0) {
		// 	time = performance.now();
		// 	console.log(time - prevTime);
		// 	prevTime = time;
		// }
		if (!this._serialPort.writable) return;
		if (!this._readyToWrite) return;

		// toggle break
		this._serialPort.set({ brk: true, rts: false });
		await wait(1);
		this._serialPort.set({ brk: false, rts: false });
		await wait(1);

		const dataToWrite = this.getUniverseBuffer();

		this._readyToWrite = false;
		this._serialPort.write(dataToWrite);
		this._serialPort.drain(() => {
			this._readyToWrite = true;
		});
	}

	get(channel: number): number {
		return this._universeBuffer[channel];
	}

	update(channel: number, value: number): void {
		this._universeBuffer[channel] = value;
		this.emit("bufferUpdate"); // todo: only send specific data that has been updated, instead of relying on entire buffer being re-read
	}

	updateSelect(channels: Array<number>, val: number): void {
		for (const c of channels) {
			this._universeBuffer[c] = val;
		}
		this.emit("bufferUpdate");
	}

	updateEach(channels: UniverseData): void {
		for (const c in channels) {
			this._universeBuffer[c] = channels[c];
		}
		this.emit("bufferUpdate");
	}

	updateAll(value: number): void {
		for (let i = 1; i <= 512; i++) {
			this._universeBuffer[i] = value;
		}
		this.emit("bufferUpdate");
	}
}
