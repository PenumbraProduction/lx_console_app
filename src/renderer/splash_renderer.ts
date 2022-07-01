import "../../css/splash.scss";

import { SplashAPI } from "../main/splash_preload";

type BridgedWindow = Window &
	typeof globalThis & {
		splashApi: any;
	};

export const api: SplashAPI = (window as BridgedWindow).splashApi.api;

const spotlightSize = 250;

document.documentElement.style.setProperty("--spotlight-size", spotlightSize.toString() + "px");

document.addEventListener(
	"mousemove",
	function (event) {
		// Get the coordinates of the title
		const titleRect = document.querySelector(".title").getBoundingClientRect();

		// Grab the mouse's X-position
		const mouseX = event.clientX;

		// Position spotlight x coordinate based on mouse x, center based on width of spotlight, take into account element x offset
		const spotlightX = mouseX - spotlightSize / 2 - titleRect.left;

		// Grab the mouse's Y position
		const mouseY = event.clientY;

		// Position spotlight y coordinate based on mouse y, center based on width of spotlight, take into account element y offset
		const spotlightY = mouseY - spotlightSize / 2 - titleRect.top;

		// Set x and y position of spotlight
		const element = document.querySelector(".title") as HTMLElement;
		element.style.backgroundPosition = spotlightX + "px " + spotlightY + "px";
	},
	false
);


api.ipcHandle("updateLoadingJob", (e,data) => {
    document.querySelector(".currentJob").textContent = data;
});