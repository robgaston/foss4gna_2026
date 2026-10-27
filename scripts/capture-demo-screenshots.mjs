// Captures the deck's screenshot of the demo instance's graph designer.
//
//   node scripts/capture-demo-screenshots.mjs
//
//   ARCHES_URL        default http://localhost:8003
//   PLAYWRIGHT_MODULE default: the playwright install in ~/Projects/arches-geolibre
//
// Needs the demo instance running (notes/foss4gna/demo_project.md).

import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { PERSON_GRAPH_ID } from "./demo/search-filters.mjs";

const archesUrl = process.env.ARCHES_URL ?? "http://localhost:8003";
const playwrightModule =
    process.env.PLAYWRIGHT_MODULE ??
    path.join(homedir(), "Projects/arches-geolibre/node_modules/playwright");
const { chromium } = createRequire(import.meta.url)(playwrightModule);

const outputDirectory = path.resolve("assets/screenshots");
const viewport = { width: 1600, height: 900 };

const shots = [
    // The Person model in the graph designer (slide 5's vertical slide).
    { name: "graph-designer-person", url: `/graph_designer/${PERSON_GRAPH_ID}`, waitMs: 6000, signIn: true },
];

async function signIn(page) {
    await page.goto(`${archesUrl}/auth/`);
    await page.fill("input[name=username]", "admin");
    await page.press("input[name=username]", "Enter");
    await page.waitForSelector("input[name=password]", { state: "visible" });
    await page.fill("input[name=password]", "admin");
    await page.press("input[name=password]", "Enter");
    await page.waitForLoadState("networkidle");
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
    for (const shot of shots) {
        const context = await browser.newContext({
            viewport: { ...viewport, height: shot.height ?? viewport.height },
            deviceScaleFactor: 2,
        });
        const page = await context.newPage();
        if (shot.signIn) {
            await signIn(page);
        }
        await page.goto(`${archesUrl}${shot.url}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(shot.waitMs);
        const file = path.join(outputDirectory, `${shot.name}.png`);
        await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
        console.log(`Saved ${file}`);
        await context.close();
    }
} finally {
    await browser.close();
}
