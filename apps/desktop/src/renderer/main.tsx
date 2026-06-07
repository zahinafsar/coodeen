import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { wireChatStore } from "./stores/chat-store";

wireChatStore();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    window.electronAPI.opencode.reconnect().catch(() => {});
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
