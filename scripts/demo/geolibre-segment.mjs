// The GeoLibre part of the demo recording: load the Arches Monument layer,
// find Rancho Vega, then give the Lockheed-Vega plant (a record with no
// geometry) its first footprint and push it as a provisional edit.

import {
    ARCHES_URL,
    CONTRIBUTOR_USERNAME,
    DEMO_PASSWORD,
    MONUMENT_LAYER_NAME,
    PLANT_NAME,
    RANCHO_VEGA,
    harness,
} from "./config.mjs";

const WORKLIST_LAYER_NAME = `${MONUMENT_LAYER_NAME} (worklist)`;
// A rough outline southeast of the airport, as fractions of the map. The real
// site needs research from historic maps; the demo says so.
const PLANT_OUTLINE = [
    [0.56, 0.55],
    [0.67, 0.53],
    [0.69, 0.66],
    [0.58, 0.68],
];

async function signInToPlugin(studio, director) {
    const { page, panel, pause, glideAndClick, typeInto } = studio;
    await director.caption("Open the Arches plugin and sign in as a contributor, not a reviewer");
    await glideAndClick(page.getByRole("button", { name: "Plugins", exact: true }));
    await page.getByRole("menuitem", { name: /^Installed/ }).hover();
    await glideAndClick(page.getByRole("menuitem", { name: /^Arches/ }));
    await page.keyboard.press("Escape");
    await pause(800);

    await typeInto(panel.getByLabel("Arches URL"), ARCHES_URL, 15);
    await glideAndClick(panel.getByRole("button", { name: "Use a password instead" }));
    await typeInto(panel.getByLabel("Username"), CONTRIBUTOR_USERNAME, 20);
    await typeInto(panel.getByPlaceholder("Password"), DEMO_PASSWORD, 10);
    await glideAndClick(panel.getByRole("button", { name: "Sign in", exact: true }));
    await panel.getByText("Signed in to").waitFor({ timeout: 30_000 });
    await pause(1200);
}

async function searchPlace(studio, text) {
    const { page, pause, typeInto } = studio;
    const searchBox = page.getByPlaceholder(/Search layers, places/);
    await searchBox.fill("");
    await typeInto(searchBox, text);
    await pause(2000);
    await searchBox.press("Enter");
    await pause(3000);
    await searchBox.fill("");
    await pause(500);
}

async function zoomTowards(studio, coordinate, steps) {
    const { page, pause } = studio;
    for (let step = 0; step < steps; step += 1) {
        const point = await studio.screenPoint(coordinate);
        await page.mouse.move(point.x, point.y, { steps: 10 });
        await page.mouse.wheel(0, -300);
        await pause(700);
    }
    await pause(1500);
}

export async function showArchesInGeoLibre(studio, director) {
    const { panel, pause, glideAndClick } = studio;
    await director.goto(harness.GEOLIBRE_URL);
    await director.caption("GeoLibre: an open-source GIS that runs entirely in the browser");
    await pause(1500);
    await signInToPlugin(studio, director);

    await director.caption("Add the Arches Monument layer, styled as it is in Arches");
    await glideAndClick(
        panel.getByRole("button", { name: "Add Geospatial Coordinates to the map" }).nth(2),
    );
    await studio.layerRow(MONUMENT_LAYER_NAME).waitFor({ timeout: 120_000 });
    await pause(1500);

    await director.caption("Rancho Vega: the same 27 footprints, with the same permissions");
    await searchPlace(studio, `${RANCHO_VEGA.latitude}, ${RANCHO_VEGA.longitude}`);
    await zoomTowards(studio, RANCHO_VEGA, 10);
    await pause(1500);
    await director.still("geolibre-rancho-vega");
    await pause(2000);
}

export async function mapTheUnmappedPlant(studio, director) {
    const { page, panel, pause, glideTo, glideAndClick } = studio;
    await director.caption("Now the Lockheed-Vega plant: in Arches, but never mapped");
    const section = panel.locator(".edit-resources-section");
    await glideAndClick(section.getByLabel("Model and geometry to edit"));
    await glideAndClick(page.getByRole("option", { name: MONUMENT_LAYER_NAME }));
    await glideAndClick(section.getByRole("button", { name: "Start a worklist" }));
    const missingCount = section.getByText(/resources? ha(s|ve) no Geospatial Coordinates/);
    await missingCount.waitFor({ timeout: 30_000 });
    await director.caption("It has no geometry, so no spatial view, and no map, can show it");
    await glideTo(missingCount);
    await pause(2500);
    await glideAndClick(section.getByRole("button", { name: `Add ${PLANT_NAME} to the worklist` }));
    await pause(1200);
    await director.still("geolibre-worklist");

    await director.caption("Find the plant's site near the Burbank airport");
    await searchPlace(studio, "Hollywood Burbank Airport");
    const viewMenu = page.getByRole("button", { name: "View", exact: true });
    for (let step = 0; step < 2; step += 1) {
        await glideAndClick(viewMenu);
        await glideAndClick(page.getByRole("menuitem", { name: "Zoom In" }));
        await pause(700);
    }

    await director.caption("Draw a rough footprint for it");
    await studio.openLayerAction(WORKLIST_LAYER_NAME, "Edit geometry");
    await pause(1000);
    await studio.drawPolygon(PLANT_OUTLINE);
    await pause(800);
    await glideAndClick(
        studio.layerRow(WORKLIST_LAYER_NAME).getByRole("button", { name: "Save", exact: true }),
    );
    const worklistChanges = panel.locator(".layer-changes").filter({ hasText: "(worklist)" });
    const attachedToPlant = worklistChanges.getByText(`Attach to ${PLANT_NAME}`);
    await attachedToPlant.waitFor({ timeout: 30_000 });
    await director.caption("What you draw goes to the record you're working on");
    await glideTo(attachedToPlant);
    await pause(2000);
    await director.still("geolibre-resource-first");

    await director.caption("Push it to Arches. A contributor's edit is saved as provisional");
    await glideAndClick(worklistChanges.getByRole("button", { name: "Push to Arches" }));
    const pushResult = panel.getByText(/Saved [1-9]\d* tile|wasn't saved/).first();
    await pushResult.waitFor({ timeout: 60_000 });
    if ((await pushResult.innerText()).includes("wasn't saved")) {
        throw new Error(`Push failed: ${await pushResult.innerText()}`);
    }
    await pause(1500);
    await director.still("geolibre-pushed");
    await director.caption("In Arches, a record can exist semantically before it exists spatially");
    await pause(4000);
}
