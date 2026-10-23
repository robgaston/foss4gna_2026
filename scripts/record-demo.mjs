// Records the whole FOSS4G NA demo as one captioned video: screening a
// corridor in Arches, Rancho Vega's relationships, the Arches data in
// GeoLibre, mapping the Lockheed-Vega plant (a record with no geometry), and
// reviewing that edit back in Arches. Also saves stills for the deck's recap
// slides. The plant's geometry is removed again afterwards.
//
//   node scripts/record-demo.mjs
//
//   ARCHES_URL           default http://localhost:8003
//   ARCHES_GEOLIBRE_DIR  default ~/Projects/arches-geolibre (its demo harness
//                        and GeoLibre web build are reused)
//
// Needs the demo instance (notes/foss4gna/demo_project.md) and GeoLibre's web
// build with the plugin (arches-geolibre docs/testing.md).

import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import {
    followRelationships,
    openRanchoVega,
    reviewInArches,
    screenCorridor,
} from "./demo/arches-segment.mjs";
import {
    ensurePlantHasNoGeometry,
    plantGeometryFeatureCount,
    recordGeometryWrites,
    undoGeometryWrites,
} from "./demo/cleanup.mjs";
import {
    PLANT_NAME,
    SCREENSHOT_DIRECTORY,
    VIDEO_DIRECTORY,
    harness,
} from "./demo/config.mjs";
import { mapTheUnmappedPlant, showArchesInGeoLibre } from "./demo/geolibre-segment.mjs";

const VIDEO_NAME = "foss4gna-demo";

function titleCardHtml(heading, subheading) {
    return `<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;
        justify-content:center;padding:0 9vw;background:#1f2326;color:#fff;font-family:Montserrat,Helvetica,Arial,sans-serif">
        <div style="color:#c4151a;font-weight:700;letter-spacing:.18em;text-transform:uppercase;font-size:1.1rem">
            FOSS4G North America 2026 · Relationships Are the Data</div>
        <div style="font-size:3.4rem;font-weight:700;margin:1.2rem 0 1rem;max-width:22ch;line-height:1.1">${heading}</div>
        <div style="font-size:1.5rem;color:#c9c6c1;max-width:48ch;line-height:1.4">${subheading}</div>
        </body></html>`;
}

/** Captions that survive page loads, and stills taken without them. */
function createDirector(page) {
    let currentCaption = "";
    const showCaption = (text) => page.evaluate((value) => window.showCaption(value), text);
    return {
        async caption(text) {
            currentCaption = text;
            await showCaption(text);
        },
        async goto(url) {
            await page.goto(url, { waitUntil: "networkidle" });
            await page.waitForTimeout(800);
            await showCaption(currentCaption);
        },
        async titleCard(heading, subheading, milliseconds) {
            await page.setContent(titleCardHtml(heading, subheading));
            await page.waitForTimeout(milliseconds);
        },
        async still(name) {
            await showCaption("");
            await page.waitForTimeout(400);
            const file = path.join(SCREENSHOT_DIRECTORY, `${name}.png`);
            await page.screenshot({ path: file });
            console.log(`Saved ${file}`);
            await showCaption(currentCaption);
        },
    };
}

await ensurePlantHasNoGeometry();
await mkdir(SCREENSHOT_DIRECTORY, { recursive: true });
await mkdir(VIDEO_DIRECTORY, { recursive: true });
const previewServer = await harness.ensurePreviewServer();
let writes = [];
try {
    const recordedPath = await harness.recordVideo(VIDEO_NAME, async (studio) => {
        const director = createDirector(studio.page);
        writes = recordGeometryWrites(studio.page);
        await director.titleCard(
            "Arches + GeoLibre, with real Los Angeles data",
            "Screen a corridor, follow a resource's relationships, then map a record that has no geometry yet.",
            4500,
        );
        await screenCorridor(studio, director);
        await openRanchoVega(studio, director);
        await followRelationships(studio, director);
        await showArchesInGeoLibre(studio, director);
        await mapTheUnmappedPlant(studio, director);
        await reviewInArches(studio, director);
        await director.caption("");
        await director.titleCard(
            "The relationships are the data",
            "Arches: archesproject.org · github.com/archesproject/arches<br>Slides: rgaston.com/foss4gna_2026",
            4000,
        );
    });
    const target = path.join(VIDEO_DIRECTORY, path.basename(recordedPath));
    await copyFile(recordedPath, target);
    await rm(recordedPath);
    console.log(`Saved ${target}`);
} finally {
    await undoGeometryWrites(writes);
    console.log(`${PLANT_NAME} now has ${await plantGeometryFeatureCount()} geometry feature(s).`);
    if (previewServer) {
        process.kill(-previewServer.pid);
    }
}
