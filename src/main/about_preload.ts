window.addEventListener("DOMContentLoaded", () => {
	document.getElementById("electron").textContent = process.versions["electron"];
	document.getElementById("node").textContent = process.versions["node"];
	document.getElementById("chromium").textContent = process.versions["chrome"];
});