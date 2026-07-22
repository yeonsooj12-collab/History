import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [html, css, bundle] = await Promise.all([
  readFile(resolve(root, "index.html"), "utf8"),
  readFile(resolve(root, "styles.css"), "utf8"),
  build({
    entryPoints: [resolve(root, "js/app.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    write: false,
  }),
]);

const javascript = bundle.outputFiles[0].text;
const widgetHtml = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>${css}</style>`)
  .replace('<script type="module" src="js/app.js"></script>', `<script>${javascript}</script>`)
  .replace("ChatGPT·Claude·Gemini 등", "패널에서 ChatGPT로 바로 전송")
  .replace("답변을 여기로 가져오기", "ChatGPT 답변 확인하기")
  .replace("최종 요청을 다시 내 AI로", "선택한 쟁점을 다시 ChatGPT로")
  .replace("내 AI에 붙여넣기", "ChatGPT로 보내기");

const output = resolve(root, "public/history-lens-widget.html");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, widgetHtml, "utf8");
console.log(`Built ${output}`);
