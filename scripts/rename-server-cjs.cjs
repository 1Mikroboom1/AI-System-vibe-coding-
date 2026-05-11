#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const serverDir = path.join(__dirname, "..", "dist", "server");

if (!fs.existsSync(serverDir)) {
  console.log("dist/server does not exist, skipping rename");
  process.exit(0);
}

// Rename all .js files in dist/server to .cjs
const files = fs.readdirSync(serverDir);
files.forEach((file) => {
  if (file.endsWith(".js")) {
    const oldPath = path.join(serverDir, file);
    const newPath = path.join(serverDir, file.replace(/\.js$/, ".cjs"));
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed: ${file} -> ${path.basename(newPath)}`);
  }
});

console.log("Server files renamed to .cjs");
