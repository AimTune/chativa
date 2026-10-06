// A deliberately plain Vue 2.7 + webpack 5 + vue-loader 15 setup — the
// stack a legacy Vue 2 app is typically still on.
//
// Unlike examples/react-vite (which aliases every @chativa/* package to its
// TypeScript source), this example consumes the packages' *built* `dist/`
// output exactly like an app installing them from npm would — so run
// `pnpm build` at the repo root first.
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { VueLoaderPlugin } = require("vue-loader");

module.exports = {
  entry: "./src/main.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash].js",
    clean: true,
  },
  resolve: {
    extensions: [".js", ".vue"],
    alias: {
      // Pin every `import "vue"` — the app's and @chativa/vue2's — to this
      // example's own Vue 2.7 copy, so a workspace that also contains Vue 3
      // can never hand the wrapper a second, different Vue.
      vue$: path.dirname(require.resolve("vue/package.json")),
    },
  },
  module: {
    rules: [
      { test: /\.vue$/, loader: "vue-loader" },
      { test: /\.css$/, use: ["vue-style-loader", "css-loader"] },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({ template: "./index.html" }),
  ],
  // `@chativa/ui` (Lit + i18next + marked + GenUI) is a sizable chunk; it is
  // loaded lazily by the wrapper, so the default 244 KiB hint is just noise.
  performance: { hints: false },
  devServer: { port: 5174, open: false },
};
