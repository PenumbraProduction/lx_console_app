export function isNumber(d: any): boolean {
    if(isNaN(d)) return false;
	if (typeof d == "number") return true;
    return !isNaN(parseInt(d));
}
