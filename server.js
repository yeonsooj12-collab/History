import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
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
const configuredDomain = process.env.APP_DOMAIN ?? process.env.RENDER_EXTERNAL_URL;
const appDomain = configuredDomain
  ? new URL(configuredDomain).origin
  : undefined;

const pendingRequests = new Map();
const requestTtlMs = 30 * 60 * 1000;

const stringList = z.array(z.string());
const historicalCaseSchema = z.object({
  title: z.string(),
  period: z.string(),
  region: z.string(),
  context: z.string(),
  insight: z.string(),
  verificationKeywords: z.array(z.string()).min(1).max(5),
});
const axisSchema = z.object({
  id: z.string(),
  title: z.string(),
  coreInsight: z.string(),
  centralContradiction: z.string(),
  usedElements: stringList,
  deferredElements: stringList,
  bridge: z.string(),
  assumptions: z.array(z.string()).max(2),
  whyThisAxisMatters: z.string(),
  specificQuestion: z.string(),
  historicalCases: z.array(historicalCaseSchema).min(1).max(2),
  similarities: z.array(z.string()).min(1).max(2),
  differences: z.array(z.string()).min(1).max(2),
  humanBehaviorPattern: z.string(),
  futureInsight: z.string(),
  verificationKeywords: z.array(z.string()).min(3).max(5),
});
const axisFinderSchema = z.object({
  version: z.string(),
  status: z.enum(["success", "incomplete", "fallback", "error"]),
  interpretationMode: z.literal("axis-finder"),
  overview: z.string(),
  axes: z.array(axisSchema).length(3),
  unresolvedElements: stringList,
  editorNote: z.string(),
});

function pruneExpiredRequests() {
  const cutoff = Date.now() - requestTtlMs;
  for (const [requestId, value] of pendingRequests) {
    if (value.createdAt < cutoff) pendingRequests.delete(requestId);
  }
}

function createHistoryLensServer() {
  const server = new McpServer(
    { name: "history-lens", version: "0.4.0" },
    {
      instructions:
        "세계사 조건 렌즈는 사용자의 사회 조건을 서로 다른 세계사 비교 쟁점 3개로 나눕니다. 사용자가 렌즈, 비교 쟁점, 역사 패널을 요청하면 open_history_lens를 호출해 패널을 여세요. 패널이 requestId와 함께 1차 분석을 요청하면 반드시 정확히 3개의 축을 만든 뒤 show_history_lens_axes를 호출해 결과를 패널로 돌려보내세요.",
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
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
              ...(appDomain ? { domain: appDomain } : {}),
            },
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
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

  registerAppTool(
    server,
    "prepare_history_lens_request",
    {
      title: "세계사 렌즈 1차 요청 준비",
      description: "패널 내부에서 1차 분석 요청의 상태를 잠시 보관합니다.",
      inputSchema: {
        resultSnapshot: z.record(z.any()),
      },
      outputSchema: {
        status: z.string(),
        requestId: z.string(),
      },
      _meta: {
        ui: { visibility: ["app"] },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ resultSnapshot }) => {
      pruneExpiredRequests();
      const requestId = randomUUID();
      pendingRequests.set(requestId, {
        createdAt: Date.now(),
        resultSnapshot,
      });
      return {
        content: [{ type: "text", text: "1차 세계사 분석 요청을 준비했습니다." }],
        structuredContent: { status: "prepared", requestId },
      };
    },
  );

  registerAppTool(
    server,
    "show_history_lens_axes",
    {
      title: "세계사 비교 쟁점 3개 표시",
      description:
        "세계사 조건 렌즈 패널에서 시작된 1차 요청을 분석한 뒤 호출합니다. requestId를 그대로 전달하고, 서로 다른 역사 학습 쟁점 정확히 3개를 analysis에 담아 패널로 돌려보냅니다.",
      inputSchema: {
        requestId: z.string().uuid(),
        analysis: axisFinderSchema,
      },
      outputSchema: {
        status: z.string(),
        requestId: z.string(),
        resultSnapshot: z.record(z.any()),
        analysis: axisFinderSchema,
      },
      _meta: {
        ui: { resourceUri: widgetUri },
        "openai/outputTemplate": widgetUri,
        "openai/toolInvocation/invoking": "세계사 비교 쟁점 3개를 정리하는 중",
        "openai/toolInvocation/invoked": "세계사 비교 쟁점 3개를 패널에 표시했습니다",
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ requestId, analysis }) => {
      pruneExpiredRequests();
      const pending = pendingRequests.get(requestId);
      if (!pending) {
        return {
          isError: true,
          content: [{ type: "text", text: "요청 상태가 만료되었습니다. 패널에서 1차 요청을 다시 보내주세요." }],
        };
      }
      pendingRequests.delete(requestId);
      return {
        content: [{ type: "text", text: "분석한 세계사 비교 쟁점 3개를 패널에 표시했습니다. 사용자가 한 축을 선택하면 2차 학습 요청을 이어가세요." }],
        structuredContent: {
          status: "axes-ready",
          requestId,
          resultSnapshot: pending.resultSnapshot,
          analysis,
        },
      };
    },
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
