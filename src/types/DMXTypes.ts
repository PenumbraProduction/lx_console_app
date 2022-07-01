export type Profile = {
	id: string;
	brand: string;
	name: string;
	channels: FixtureChannel[];
	channelModes: FixtureChannelMode[];
};

export type FixtureChannel = {
	name: string;
	type: FixtureChannelType;
	bounds?: FixtureChannelBounds[];
};

export type FixtureChannelType =
	| "GENERIC"
	| "INTENSITY"
	| "COLOUR_WHEEL"
	| "COLOUR-RED"
	| "COLOUR-GREEN"
	| "COLOUR-BLUE"
	| "COLOUR-CYAN"
	| "COLOUR-YELLOW"
	| "COLOUR-YELLOW"
	| "GOBO-WHEEL"
	| "SHUTTER"
	| "POS-PAN"
	| "POS-PAN-FINE"
	| "POS-TILT"
	| "POS-TILT-FINE"
	| "FUNCTION";

export type FixtureChannelBounds = {
	name: string;
	start: number;
	end: number;
};

export type FixtureChannelMode = {
	count: number;
	channels: number[]; // ordered array of indexes of each FixtureChannel
};

export type DmxAddressRange = {
	initial: number;
	final: number;
};

export type ProfileSettings = {
    channelMode: number;
}

export type PatchChannel = {
	channel: number;
	name: string;
	profile: string; // unique ID relating to profile in library
    profileSettings: ProfileSettings;
	address: DmxAddressRange;
};