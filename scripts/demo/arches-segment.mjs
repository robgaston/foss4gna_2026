// The Arches parts of the demo recording: screen a corridor, open Rancho
// Vega, follow its relationships to Paul R. Williams, and (at the end) review
// the GeoLibre edit as a reviewer.

import {
    ARCHES_URL,
    DEMO_PASSWORD,
    PLANT_RESOURCE_ID,
    RANCHO_VEGA_RESOURCE_ID,
    REVIEWER_USERNAME,
} from "./config.mjs";

// A strip about 180 m wide along Oxnard Street, standing in for a proposed
// utility corridor. Rancho Vega is the only inventoried resource it touches.
const CORRIDOR = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { buffer: { width: 0, unit: "m" }, inverted: false },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [-118.395, 34.1787],
                        [-118.335, 34.1787],
                        [-118.335, 34.1803],
                        [-118.395, 34.1803],
                        [-118.395, 34.1787],
                    ],
                ],
            },
        },
    ],
};

const termFilter = (term) =>
    JSON.stringify([
        {
            type: "string",
            context: "",
            context_label: "",
            id: term,
            text: term,
            value: term,
            inverted: false,
        },
    ]);

async function waitForSearchResults(page) {
    await page.getByText(/Results: \d+ of \d+/).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
}

/** Jumps without animating, to skip past sections not worth showing. */
async function jumpTo(page, text) {
    await page
        .getByText(text, { exact: true })
        .first()
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(600);
}

async function smoothScrollTo(page, text) {
    await page
        .getByText(text, { exact: true })
        .first()
        .evaluate((element) => element.scrollIntoView({ behavior: "smooth", block: "start" }));
    await page.waitForTimeout(1800);
}

export async function screenCorridor(studio, director) {
    const { page, pause, glideTo } = studio;
    const query = new URLSearchParams({ "map-filter": JSON.stringify(CORRIDOR) });
    await director.goto(`${ARCHES_URL}/search?${query}`);
    await waitForSearchResults(page);
    await director.caption(
        "Arches: screen a hypothetical utility corridor along Oxnard Street, North Hollywood",
    );
    await pause(4000);
    await glideTo(page.getByText("Rancho Vega", { exact: true }).first());
    await director.caption(
        "One inventoried resource is in the way: Rancho Vega. It isn't a designated landmark",
    );
    await pause(3500);
}

export async function openRanchoVega(studio, director) {
    const { page, pause } = studio;
    await director.caption("");
    await director.goto(`${ARCHES_URL}/report/${RANCHO_VEGA_RESOURCE_ID}`);
    await page.getByRole("switch", { name: "Hide Null Values" }).click();
    // The report prints geometry as raw GeoJSON; the header map already shows it.
    await page
        .getByText("Geospatial Coordinates", { exact: true })
        .evaluateAll((labels) =>
            labels.forEach((label) => {
                const row = label.closest(".row, tr, dl, div[class*='row']") ?? label.parentElement;
                row.style.display = "none";
            }),
        );
    await page.waitForTimeout(600);
    await director.caption(
        "On its own, an unremarkable record: garden apartments, 27 building footprints, built 1945",
    );
    await pause(3500);
    await smoothScrollTo(page, "Descriptions");
    await pause(2500);
    // The Geometry section prints raw GeoJSON, so jump straight past it.
    await jumpTo(page, "Construction Phases");
    await director.caption("Its type comes from a thesaurus, and its date is an EDTF value");
    await pause(3000);
    await smoothScrollTo(page, "Associated People and Organizations");
    await director.caption(
        "But look at who it's connected to: Paul R. Williams, architect, and the Lockheed-Vega plant",
    );
    await pause(4500);
}

export async function followRelationships(studio, director) {
    const { page, pause, glideAndClick } = studio;
    const ranchoVegaQuery = new URLSearchParams({ "term-filter": termFilter("Rancho Vega") });
    await director.goto(`${ARCHES_URL}/search?${ranchoVegaQuery}`);
    await waitForSearchResults(page);
    await glideAndClick(page.getByText("Related Resources").first());
    await director.caption(
        "Eleven relationships: architect, developer, the plant it housed workers for, the survey, the sources",
    );
    await pause(5000);

    const williamsQuery = new URLSearchParams({
        "term-filter": termFilter("Paul Revere Williams"),
    });
    await director.goto(`${ARCHES_URL}/search?${williamsQuery}`);
    await waitForSearchResults(page);
    await glideAndClick(page.getByText("Related Resources").first());
    await director.caption(
        "Follow the architect: 16 works, 7 of them LA landmarks. The City's own layer has no architect field",
    );
    await pause(5500);
    await director.caption("This network is what makes Rancho Vega significant");
    await pause(3000);
}

export async function reviewInArches(studio, director) {
    const { page, pause, glideTo, typeInto } = studio;
    // Signing in with ?next= lands on the plant's record, not the home page.
    const next = encodeURIComponent(`/resource/${PLANT_RESOURCE_ID}`);
    await director.caption("Back in Arches, sign in as a reviewer");
    await director.goto(`${ARCHES_URL}/auth/?next=${next}`);
    await typeInto(page.locator("input[name=username]"), REVIEWER_USERNAME, 25);
    await page.press("input[name=username]", "Enter");
    const passwordInput = page.locator("input[name=password]");
    await passwordInput.waitFor({ state: "visible" });
    await typeInto(passwordInput, DEMO_PASSWORD, 15);
    await director.caption(
        "The plant's new geometry is waiting for review: context added without bypassing governance",
    );
    await page.press("input[name=password]", "Enter");
    await page.waitForURL(`**/resource/${PLANT_RESOURCE_ID}**`, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    await director.reshow();
    await pause(2000);
    await glideTo(page.getByText("provisional edits", { exact: false }).first());
    await pause(4000);
    await director.still("arches-provisional-edit");
    await pause(1500);
}
