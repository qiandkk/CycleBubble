import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bundledNodeModules =
  process.env.CODEX_NODE_MODULES ||
  "C:\\Users\\domain\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const playwrightPath =
  process.env.PLAYWRIGHT_PACKAGE ||
  path.join(bundledNodeModules, ".pnpm", "playwright@1.60.0", "node_modules", "playwright");
const { chromium } = require(playwrightPath);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "dist");
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 1 });
await page.goto(`file://${path.join(root, "index.html").replaceAll("\\", "/")}`);
await page.screenshot({
  path: path.join(out, "cyclebubble-product-board.png"),
  fullPage: true
});

const mobile = await browser.newPage({
  viewport: { width: 390, height: 900 },
  deviceScaleFactor: 2,
  isMobile: true
});
await mobile.goto(`file://${path.join(root, "index.html").replaceAll("\\", "/")}`);
await mobile.locator(".phone-screen").screenshot({
  path: path.join(out, "cyclebubble-home-mobile.png")
});

await browser.close();
