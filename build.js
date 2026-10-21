// build.js - inlines docs/graph.js into docs/app.html and writes docs/index.html
// (a complete page for GitHub Pages) and dist/app-artifact.html.
const fs = require("fs");
const graph = fs.readFileSync("docs/graph.js", "utf8").replace(/^if \(typeof module.*$/m, "");
const body = fs.readFileSync("docs/app.html", "utf8").replace("/*GRAPH_JS*/", graph);
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/app-artifact.html", body);
fs.writeFileSync("docs/index.html",
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
  `<style>html{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log("built docs/index.html");
