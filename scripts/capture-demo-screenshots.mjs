// Captures backup screenshots of the FOSS4G NA demo instance for the deck.
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

import {
    PERSON_GRAPH_ID,
    corridorSearchQuery,
    ranchoVegaSearchQuery,
    williamsSearchQuery,
} from "./demo/search-filters.mjs";

const archesUrl = process.env.ARCHES_URL ?? "http://localhost:8003";
const playwrightModule =
    process.env.PLAYWRIGHT_MODULE ??
    path.join(homedir(), "Projects/arches-geolibre/node_modules/playwright");
const { chromium } = createRequire(import.meta.url)(playwrightModule);

const outputDirectory = path.resolve("assets/screenshots");
const viewport = { width: 1600, height: 900 };

const resourceIds = {
    ranchoVega: "04c47869-64f3-5b50-8f7f-7b2641327812",
    paulRWilliams: "8ec6c939-0f1b-5bc0-aaa0-1b213c83e927",
    lockheedVegaPlant: "b54fe8e0-4754-500c-ac83-32f97df97650",
};

const shots = [
    // The corridor screen from demo step A1, for recap slide 1.
    { name: "search-rancho-vega", url: `/search?${corridorSearchQuery()}`, waitMs: 6000 },
    { name: "search-paul-r-williams", url: `/search?${williamsSearchQuery()}`, waitMs: 6000 },
    {
        name: "related-rancho-vega",
        url: `/search?${ranchoVegaSearchQuery()}`,
        waitMs: 5000,
        clickText: "Related Resources",
    },
    {
        name: "related-paul-r-williams",
        url: `/search?${williamsSearchQuery()}`,
        waitMs: 5000,
        clickText: "Related Resources",
    },
    // Reports scroll inside their own container, so a tall viewport stands in for a full-page capture.
    { name: "report-rancho-vega", url: `/report/${resourceIds.ranchoVega}`, waitMs: 5000, height: 4200, hideNullValues: true },
    { name: "report-paul-r-williams", url: `/report/${resourceIds.paulRWilliams}`, waitMs: 5000, height: 3600, hideNullValues: true },
    { name: "report-lockheed-vega-plant", url: `/report/${resourceIds.lockheedVegaPlant}`, waitMs: 5000, height: 2400, hideNullValues: true },
    // Viewport-sized views of the Rancho Vega report, for the demo recap slides.
    { name: "report-rancho-vega-top", url: `/report/${resourceIds.ranchoVega}`, waitMs: 5000, hideNullValues: true },
    {
        name: "report-rancho-vega-construction",
        url: `/report/${resourceIds.ranchoVega}`,
        waitMs: 5000,
        hideNullValues: true,
        scrollToText: "Construction Phases",
    },
    {
        name: "report-rancho-vega-actors",
        url: `/report/${resourceIds.ranchoVega}`,
        waitMs: 5000,
        hideNullValues: true,
        scrollToText: "Associated People and Organizations",
    },
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
        if (shot.clickText) {
            await page.getByText(shot.clickText).first().click();
            await page.waitForTimeout(5000);
        }
        if (shot.hideNullValues) {
            await page.getByRole("switch", { name: "Hide Null Values" }).click();
            await page.waitForTimeout(1000);
        }
        if (shot.scrollToText) {
            const heading = page.getByText(shot.scrollToText, { exact: true }).first();
            await heading.evaluate((element) => element.scrollIntoView({ block: "start" }));
            await page.waitForTimeout(1000);
        }
        const file = path.join(outputDirectory, `${shot.name}.png`);
        await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
        console.log(`Saved ${file}`);
        await context.close();
    }
} finally {
    await browser.close();
}
