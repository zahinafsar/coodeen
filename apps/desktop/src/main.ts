import { app, BrowserWindow } from "electron";
import { join } from "path";
import { registerSessionHandlers } from "./handlers/sessions.js";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerFsHandlers } from "./handlers/fs.js";
import { registerGitHandlers } from "./handlers/git.js";
import { registerPtyHandlers } from "./handlers/pty.js";
import { registerProviderHandlers } from "./handlers/providers.js";
import { registerConfigHandlers } from "./handlers/config.js";
import { registerActionHandlers } from "./handlers/actions.js";
import { ipcMain } from "electron";
import { startOpencodeSidecar, stopOpencodeSidecar } from "./handlers/opencode.js";
import { registerCoodeenHandlers, stopCoodeenWatchers } from "./handlers/coodeen.js";

let mainWindow: BrowserWindow | null = null;

function getWindow() {
  return mainWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }


  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startOpencodeSidecar();
  } catch (err) {
    console.error("[main] failed to start opencode sidecar:", err);
  }

  registerSessionHandlers();
  registerChatHandlers();
  registerFsHandlers();
  registerGitHandlers();
  registerPtyHandlers(getWindow);
  registerProviderHandlers();
  registerConfigHandlers();
  registerActionHandlers();
  registerCoodeenHandlers();

  ipcMain.handle(
    "capture:area",
    async (_e, x: number, y: number, width: number, height: number) => {
      if (!mainWindow) return null;
      const image = await mainWindow.webContents.capturePage({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
      return image.toDataURL();
    },
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopOpencodeSidecar();
  stopCoodeenWatchers();
});
