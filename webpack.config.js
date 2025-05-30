module.exports = {
  target: "webworker",
  entry: "./src/index.js",
  mode: "production",
  optimization: {
    usedExports: true
  },
  performance: {
    hints: false
  },
  output: {
    filename: "worker.js",
    path: __dirname + "/dist"
  }
};
