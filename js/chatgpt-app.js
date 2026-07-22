const isEmbedded = typeof window !== "undefined" && window.parent !== window;

let nextRpcId = 0;
const pendingRequests = new Map();

function post(message) {
  window.parent.postMessage(message, "*");
}

function rpcNotify(method, params = {}) {
  post({ jsonrpc: "2.0", method, params });
}

function rpcRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextRpcId;
    pendingRequests.set(id, { resolve, reject });
    post({ jsonrpc: "2.0", id, method, params });
  });
}

function handleHostMessage(event) {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;
  if (typeof message.id !== "number") return;
  const pending = pendingRequests.get(message.id);
  if (!pending) return;
  pendingRequests.delete(message.id);
  if (message.error) pending.reject(message.error);
  else pending.resolve(message.result);
}

async function initialize() {
  window.addEventListener("message", handleHostMessage, { passive: true });
  await rpcRequest("ui/initialize", {
    appInfo: { name: "history-lens", version: "0.2.0" },
    appCapabilities: {},
    protocolVersion: "2026-01-26",
  });
  rpcNotify("ui/notifications/initialized", {});
}

export function installChatGptAppBridge() {
  if (!isEmbedded) return;
  const ready = initialize().catch((error) => {
    console.error("ChatGPT app bridge initialization failed", error);
    throw error;
  });

  window.historyLensSendToChat = async (text) => {
    await ready;
    rpcNotify("ui/message", {
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  document.documentElement.dataset.chatgptApp = "true";
}
