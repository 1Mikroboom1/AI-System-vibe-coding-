#!/usr/bin/env node

/**
 * electron-builder NSIS Installer Script (CommonJS)
 * Builds a standalone Windows installer for Super Chat
 */

const { build, Platform, Arch } = require("electron-builder");

const config = {
  appId: "com.superchat.app",
  productName: "Super Chat",
  directories: {
    output: "release",
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
