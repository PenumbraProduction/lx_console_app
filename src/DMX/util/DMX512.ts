/**
 * default range of 0 to 255
 */
export const isWithinRange = (val: number, min=0, max=255) => val <= max && val >= min;

export const clamp = (val: number, min=0, max=255) => Math.min(Math.max(val, min), max);

export const map = (val: number, inMin: number, inMax: number, outMin: number, outMax: number) => (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

export const DMXToPercent = (val: number) => map(val, 0, 255, 0, 100);
export const PercentToDMX = (val: number) => map(val, 0, 100, 0, 255);