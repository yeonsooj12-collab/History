import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const widgetUri = "ui://widget/history-lens.html";
const widgetHtml = readFileSync("public/history-lens-widget.html", "utf8");

function createHistoryLensServer() {
  const server = new McpServer(
    { name: "history-lens", version: "0.2.0" },
    {
      instructions:
        "세계사 조건 렌즈는 사용자의 사회 조건을 서로 다른 세계사 비교 쟁점 3개로 나눕니다. 사용자가 렌즈, 비교 쟁점, 역사 패널을 요청하면 open_history_lens를 호출해 패널을 여세요.",
    },
  );

  registerAppResource(
    server,
    "history-lens-widget",
    widgetUri,
    {},
    async () => ({
      contents: [
        {
          uri: widgetUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            "openai/widgetDescription": "사회 조건을 선택해 세계사 비교 요청을 만드는 인터랙티브 패널",
            "openai/widgetPrefersBorder": true,
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "open_history_lens",
    {
      title: "세계사 조건 렌즈 열기",
      description:
        "사회 압력, 외부 조건, 행위자, 영향 집단, 분류 기준과 제도 변화를 선택하는 세계사 비교 패널을 엽니다. 사용자가 세계사 조건 렌즈나 역사 비교 패널을 요청하면 사용하세요.",
      inputSchema: {
        startingPrompt: z.string().max(1000).optional(),
      },
      outputSchema: {
        status: z.string(),
        startingPrompt: z.string().optional(),
      },
      _meta: {
        ui: { resourceUri: widgetUri },
        "openai/outputTemplate": widgetUri,
        "openai/toolInvocation/invoking": "세계사 조건 렌즈를 여는 중",
        "openai/toolInvocation/invoked": "세계사 조건 렌즈를 열었습니다",
      },
    },
    async ({ startingPrompt }) => ({
      content: [
        {
          type: "text",
          text: "세계사 조건 렌즈 패널을 열었습니다. 패널에서 조건을 선택하거나 직접 입력한 뒤 요청을 ChatGPT로 보내세요.",
        },
      ],
      structuredContent: {
        status: "ready",
        ...(startingPrompt ? { startingPrompt } : {}),
      },
    }),
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const mcpPath = "/mcp";
const allowedMethods = new Set(["POST", "GET", "DELETE"]);

const httpServer = createServer(async (req, res) => {
  if (!req.url) return res.writeHead(400).end("Missing URL");
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname.startsWith(mcpPath)) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ name: "history-lens", status: "ok", mcp: mcpPath }));
  }

  if (allowedMethods.has(req.method ?? "") && url.pathname.startsWith(mcpPath)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = createHistoryLensServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request failed", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`History Lens MCP server listening on http://localhost:${port}${mcpPath}`);
});
