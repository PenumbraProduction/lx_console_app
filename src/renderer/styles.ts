import "../../css/style.scss";

import * as feather from "feather-icons";

// Feather icons
feather.replace();

// fontawesome icons
document.querySelectorAll("[data-awesome]").forEach((elt: HTMLElement) => {
	// const svg = document.createElement("embed");
	// svg.src = `../assets/vendor/fontawesome-desktop/svgs/regular/${elt.dataset.awesome}.svg`;

	// const svg = document.createElement("object");
	// svg.type = "image/svg+xml";
	// svg.data = `../assets/vendor/fontawesome-desktop/svgs/regular/${elt.dataset.awesome}.svg`;

	const svg = document.createElement("img");
	svg.src = `../assets/vendor/fontawesome-desktop/svgs/regular/${elt.dataset.awesome}.svg`;

	elt.replaceWith(svg);
	// `<object data="${elt.dataset.awesome}.svg"></object>`
});

// hide context menu when a context menu is not clicked
$(document).on("click", function (event) {
	if (!$(event.target).closest(".context-menu").length) {
		$(".context-menu").hide();
	}
});

// prevent text selection

window.onload = () => {
	document.onselectstart = () => {
		return false;
	};
};
// document.onselectstart = () => {
// 	return false;
// };

// type ScrollPos = { top: number; left: number };
// interface scrollListenerCallback {
// 	(lastKnownScrollPosition: ScrollPos): void;
// }

// Custom Scroll listener that ensures the function isn't called loads of times
// function listenToScroll(element: HTMLElement, action: scrollListenerCallback) {
// 	const lastKnownScrollPosition: ScrollPos = { top: 0, left: 0 };
// 	let ticking = false;

// 	element.addEventListener("scroll", function () {
// 		lastKnownScrollPosition.top = element.scrollTop;
// 		lastKnownScrollPosition.left = element.scrollLeft;

// 		if (!ticking) {
// 			window.requestAnimationFrame(function () {
// 				action(lastKnownScrollPosition);
// 				ticking = false;
// 			});

// 			ticking = true;
// 		}
// 	});
// }

// Change editor title when scrolled
// listenToScroll(document.getElementById("pageContentContainer"), (pos) => {
// 	if (pos.top > 0) {
// 		document.getElementById("pageTitle").classList.add("scrolled");
// 	} else {
// 		document.getElementById("pageTitle").classList.remove("scrolled");
// 	}
// });
