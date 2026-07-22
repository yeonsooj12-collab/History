import { App } from "@modelcontextprotocol/ext-apps";

const isEmbedded = typeof window !== "undefined" && window.parent !== window;

function createApp() {
  return new App(
    { name: "history-lens", version: "0.5.2" },
    { availableDisplayModes: ["inline", "fullscreen"] },
    { autoResize: true },
  );
}

export function installChatGptAppBridge() {
  if (!isEmbedded) return;

  // Mark the document before the first render/resize measurement so the
  // embedded layout does not reserve space for the standalone landing page.
  document.documentElement.dataset.chatgptApp = "true";
  window.historyLensDisplayMode = "inline";
  const app = createApp();
  const publishDisplayMode = (mode = "inline") => {
    window.historyLensDisplayMode = mode;
    document.documentElement.dataset.chatgptDisplayMode = mode;
    window.dispatchEvent(new CustomEvent("history-lens-display-mode", { detail: { mode } }));
  };
  const publishToolResult = (params) => {
    const value = params?.structuredContent;
    if (!value) return;
    window.historyLensLatestToolResult = value;
    window.dispatchEvent(new CustomEvent("history-lens-tool-result", { detail: value }));
  };
  app.ontoolresult = publishToolResult;
  app.onhostcontextchanged = (context) => {
    publishDisplayMode(context?.displayMode || app.getHostContext()?.displayMode || "inline");
  };
  const ready = app.connect().then(() => {
    publishDisplayMode(app.getHostContext()?.displayMode || "inline");
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

  window.historyLensSendFirstStage = async ({ prompt, resultSnapshot }) => {
    const connectedApp = await ready;
    const prepared = await connectedApp.callServerTool({
      name: "prepare_history_lens_request",
      arguments: { resultSnapshot },
    });
    const requestId = prepared?.structuredContent?.requestId;
    if (!requestId) throw new Error("history_lens_request_not_prepared");

    const text = [
      prompt,
      "",
      "[ChatGPT 앱 연결 지시]",
      `이 요청은 세계사 조건 렌즈 패널의 requestId ${requestId} 에서 시작되었습니다.`,
      "위 규격에 맞는 1차 분석을 완성한 뒤 JSON을 대화 본문에 출력하지 말고, show_history_lens_axes 도구를 호출하세요.",
      "도구의 requestId에는 위 값을 그대로 넣고 analysis에는 완성한 JSON 객체를 넣으세요.",
      "도구 호출이 끝나면 사용자가 패널에서 세 축 중 하나를 선택하도록 짧게 안내하세요.",
    ].join("\n");
    const content = [{ type: "text", text }];
    await connectedApp.updateModelContext({
      content,
      structuredContent: {
        app: "history-lens",
        action: "find-three-history-axes",
        requestId,
      },
    }).catch(() => undefined);
    await connectedApp.sendMessage({ role: "user", content });
  };

  window.historyLensRequestDisplayMode = async (mode) => {
    const connectedApp = await ready;
    const result = await connectedApp.requestDisplayMode({ mode });
    publishDisplayMode(result?.mode || mode);
    return result;
  };
  window.historyLensRequestFullscreen = () => window.historyLensRequestDisplayMode("fullscreen");

  ready.catch((error) => {
    console.error("ChatGPT app bridge initialization failed", error);
  });
}
