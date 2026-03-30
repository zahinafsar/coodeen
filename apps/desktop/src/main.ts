import { app, BrowserWindow } from "electron";
import { join } from "path";
import { getDb } from "./db/client.js";
import { registerSessionHandlers } from "./handlers/sessions.js";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerFsHandlers } from "./handlers/fs.js";
import { registerGitHandlers } from "./handlers/git.js";
import { registerPtyHandlers } from "./handlers/pty.js";
import { registerProviderHandlers } from "./handlers/providers.js";
import { registerConfigHandlers } from "./handlers/config.js";
import { registerActionHandlers } from "./handlers/actions.js";
import { registerSkillHandlers } from "./handlers/skills.js";

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

app.whenReady().then(() => {
  getDb();

  registerSessionHandlers();
  registerChatHandlers(getWindow);
  registerFsHandlers();
  registerGitHandlers();
  registerPtyHandlers(getWindow);
  registerProviderHandlers();
  registerConfigHandlers();
  registerActionHandlers();
  registerSkillHandlers();

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
