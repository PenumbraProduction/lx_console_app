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

export const isWithinRange = (val: number, min=0, max=255) => val <= max && val >= min;

export const clamp = (val: number, min=0, max=255) => Math.min(Math.max(val, min), max);

export const map = (val: number, inMin: number, inMax: number, outMin: number, outMax: number) => (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

export const DMXToPercent = (val: number) => map(val, 0, 255, 0, 100);
export const PercentToDMX = (val: number) => map(val, 0, 100, 0, 255)