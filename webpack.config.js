module.exports = {
	entry: {
		renderer: "./src/renderer/renderer.ts",
		splash_renderer: "./src/renderer/splash_renderer.ts",
		prompt_renderer: "./src/renderer/prompt_renderer.ts"
	},
	output: {
		filename: "[name].js",
		libraryTarget: "var",
		library: "[name]",
		path: process.cwd() + "/out/"
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: {
					loader: "ts-loader",
					options: {
						configFile: "src/renderer/tsconfig.json"
					}
				},
				exclude: /node_modules/
			},
			{
				test: /\.s(c|a)ss$/,
				use: [
					"style-loader", // creates style nodes from JS strings
					{
						loader: "css-loader", // translates CSS into CommonJS
						options: {
							importLoaders: 1
						}
					},
					"postcss-loader", // post process the compiled CSS
					"sass-loader" // compiles Sass to CSS, using Node Sass by default
				]
			}
		]
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js"]
	},
	mode: "none",
	devtool: "source-map",
	performance: {
		maxEntrypointSize: 4250000, // 4 MB
		maxAssetSize: 4250000
	},
	optimization: {
		usedExports: true
	},
	watchOptions: {
		aggregateTimeout: 100,
		poll: 200
	}
};
