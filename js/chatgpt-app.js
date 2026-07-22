import { App } from "@modelcontextprotocol/ext-apps";

const isEmbedded = typeof window !== "undefined" && window.parent !== window;

function createApp() {
  return new App(
    { name: "history-lens", version: "0.3.0" },
    { availableDisplayModes: ["inline", "fullscreen"] },
    { autoResize: true },
  );
}

export function installChatGptAppBridge() {
  if (!isEmbedded) return;

  const app = createApp();
  const ready = app.connect().then(() => {
    document.documentElement.dataset.chatgptApp = "true";
    return app;
  });

  window.historyLensSendToChat = async (text) => {
    const connectedApp = await ready;
    const content = [{ type: "text", text }];

    // Keep the user's current lens request available to the model on later turns,
    // then create a normal user turn in the surrounding ChatGPT conversation.
    await connectedApp.updateModelContext({
      content,
      structuredContent: {
        app: "history-lens",
        action: "analyze-history-lens-request",
      },
    }).catch(() => undefined);
    await connectedApp.sendMessage({ role: "user", content });
  };

  window.historyLensRequestFullscreen = async () => {
    const connectedApp = await ready;
    return connectedApp.requestDisplayMode({ mode: "fullscreen" });
  };

  ready.catch((error) => {
    console.error("ChatGPT app bridge initialization failed", error);
  });
}
