#!/usr/bin/env node

/**
 * electron-builder NSIS Installer Script (CommonJS)
 * Builds a standalone Windows installer for Super Chat
 */

const path = require("path");
const { execFileSync } = require("child_process");
const { build, Platform, Arch } = require("electron-builder");

function killRunningElectron() {
  if (process.platform !== "win32") {
    return;
  }

  const commands = [
    ["taskkill", ["/F", "/IM", "electron.exe", "/T"]],
    ["taskkill", ["/F", "/IM", "RAG Desktop.exe", "/T"]],
    ["taskkill", ["/F", "/IM", "Super Chat.exe", "/T"]]
  ];

  for (const [command, args] of commands) {
    try {
      execFileSync(command, args, { stdio: "ignore" });
    } catch {
      // Ignore when the process is not running.
    }
  }
}

killRunningElectron();

const outputDir = path.resolve(process.cwd(), "release-package", `build-${Date.now()}`);

const config = {
  appId: "com.superchat.app",
  productName: "Super Chat",
  directories: {
    output: outputDir,
    buildResources: "electron"
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json",
    "node_modules/**/*"
  ],
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ],
    certificateFile: process.env.WIN_SIGNING_CERT || undefined,
    certificatePassword: process.env.WIN_SIGNING_CERT_PASSWORD || undefined
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Super Chat"
  }
};

const targets = Platform.WINDOWS.createTarget(["nsis"], Arch.x64);

build({
  targets,
  config
}).catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
