"use strict";

module.exports = {
	useTabs: true,
	tabWidth: 4,
	printWidth: 160,
	semi: true,
	singleQuote: false,
	trailingComma: "none",
	bracketSpacing: true,
	arrowParens: "always",
	embeddedLanguageFormatting: "auto",

	overrides: [
		{
			files: ["**.latex.js", "**.latex.ts"],
			options: {
				useTabs: false,
				tabWidth: 2
			}
		}
	]
};
