// Records the whole FOSS4G NA demo as one captioned video: screening a
// corridor in Arches, Rancho Vega's relationships, the "Williams works that
// aren't landmarks" query in arches-search, the Arches data in
// GeoLibre, mapping the Lockheed-Vega plant (a record with no geometry), and
// reviewing that edit back in Arches. The deck plays it as the demo's backup,
// with a poster frame. The demo project's reset_demo_state runs before and after.
//
//   node scripts/record-demo.mjs
//
//   ARCHES_URL           default http://localhost:8003
//   ARCHES_GEOLIBRE_DIR  default ~/Projects/arches-geolibre (its demo harness
//                        and GeoLibre web build are reused)
//   DEMO_PROJECT_DIR     default ~/Projects/arches4/foss4gna-demo
//   DEMO_PYTHON          default ~/Projects/arches4/foss4gna_demo_env/bin/python
//
// Needs the demo instance (notes/foss4gna/demo_project.md) and GeoLibre's web
// build with the plugin (arches-geolibre docs/testing.md).

import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import {
    askWhatAFlatLayerCant,
    followRelationships,
    openRanchoVega,
    reviewInArches,
    screenCorridor,
} from "./demo/arches-segment.mjs";
import { VIDEO_DIRECTORY, harness } from "./demo/config.mjs";
import { resetDemoState } from "./demo/demo-state.mjs";
import { mapTheUnmappedPlant, showArchesInGeoLibre } from "./demo/geolibre-segment.mjs";

const VIDEO_NAME = "foss4gna-demo";
const POSTER_SECONDS = 2.5;

// The eyebrow uses the deck's lighter red for dark backgrounds.
function titleCardHtml(heading, subheading) {
    return `<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;
        justify-content:center;padding:0 9vw;background:#1f2326;color:#fff;font-family:Montserrat,Helvetica,Arial,sans-serif">
        <div style="color:#f26b6f;font-weight:700;letter-spacing:.18em;text-transform:uppercase;font-size:1.1rem">
            FOSS4G North America 2026 · Relationships Are the Data</div>
        <div style="font-size:3.4rem;font-weight:700;margin:1.2rem 0 1rem;max-width:22ch;line-height:1.1">${heading}</div>
        <div style="font-size:1.5rem;color:#c9c6c1;max-width:48ch;line-height:1.4">${subheading}</div>
        </body></html>`;
}

/**
 * Captions that survive page loads. Page loads are recorded as cuts, so
 * blank pages and half-loaded searches can be removed from the video
 * afterwards.
 */
function createDirector(page, elapsedSeconds, cuts) {
    let currentCaption = "";
    // The harness's captions are sized for a monitor; enlarge them (relative
    // to the viewport) so they stay readable when the video plays in a slide.
    const showCaption = (text) =>
        page.evaluate((value) => {
            const caption = [...document.body.children].find(
                (element) => element.style.zIndex === "2147483646",
            );
            if (caption) {
                const fontSize = Math.round(window.innerWidth / 53);
                caption.style.font = `600 ${fontSize}px/1.35 system-ui, sans-serif`;
                caption.style.bottom = `${fontSize * 2}px`;
                caption.style.maxWidth = "80%";
                caption.style.padding = `${Math.round(fontSize / 2)}px ${fontSize}px`;
            }
            window.showCaption(value);
        }, text);
    return {
        async reshow() {
            await showCaption(currentCaption);
        },
        async caption(text) {
            currentCaption = text;
            await showCaption(text);
        },
        /** Navigates, waits for `ready`, and cuts everything in between. */
        async goto(url, ready = () => page.waitForTimeout(800)) {
            const cutStart = elapsedSeconds();
            await page.goto(url, { waitUntil: "networkidle" });
            await ready();
            await showCaption(currentCaption);
            await page.waitForTimeout(300);
            cuts.push([cutStart, elapsedSeconds()]);
        },
        async titleCard(heading, subheading, milliseconds) {
            await page.setContent(titleCardHtml(heading, subheading));
            await page.waitForTimeout(milliseconds);
        },
    };
}

/** Re-encodes `inputPath` without the cut ranges. */
function removeCuts(inputPath, outputPath, cuts) {
    const keep = cuts.length
        ? `not(${cuts.map(([start, end]) => `between(t,${start.toFixed(2)},${end.toFixed(2)})`).join("+")})`
        : "1";
    execFileSync("ffmpeg", [
        ...["-v", "error", "-y", "-i", inputPath],
        ...["-vf", `select='${keep}',setpts=N/FRAME_RATE/TB`],
        ...["-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p"],
        ...["-movflags", "+faststart", outputPath],
    ]);
}

resetDemoState();
await mkdir(VIDEO_DIRECTORY, { recursive: true });
const previewServer = await harness.ensurePreviewServer();
// Page loads to remove from the recording, as [start, end] seconds.
const cuts = [];
try {
    const recordedPath = await harness.recordVideo(VIDEO_NAME, async (studio) => {
        const recordingStarted = Date.now();
        const elapsedSeconds = () => (Date.now() - recordingStarted) / 1000;
        const director = createDirector(studio.page, elapsedSeconds, cuts);
        await director.titleCard(
            "Arches + GIS, real LA data",
            "Screen a corridor, follow a resource's relationships, then map a record that has no geometry yet.",
            4500,
        );
        await screenCorridor(studio, director);
        await openRanchoVega(studio, director);
        await followRelationships(studio, director);
        await askWhatAFlatLayerCant(studio, director);
        await director.caption("");
        await director.titleCard(
            "Part 2 · Bring it into your GIS",
            "GeoLibre with the Arches plugin (experimental): load the data, then map a record that has no geometry yet.",
            3500,
        );
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
    removeCuts(recordedPath, target, cuts);
    await rm(recordedPath);
    console.log(`Saved ${target} (${cuts.length} page loads cut)`);

    const posterPath = target.replace(/\.mp4$/, "-poster.png");
    execFileSync("ffmpeg", [
        ...["-v", "error", "-y", "-ss", String(POSTER_SECONDS), "-i", target],
        ...["-frames:v", "1", posterPath],
    ]);
    console.log(`Saved ${posterPath}`);
} finally {
    resetDemoState();
    if (previewServer) {
        process.kill(-previewServer.pid);
    }
}
