export const wait = (millis: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, millis));

export const debounce = (func: (...args: any[]) => void, waitMs: number) => {
	let timeout: NodeJS.Timeout;
	return function executedFunction(...args: any[]) {
		const later = () => {
			timeout = null;
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, waitMs);
	};
};
