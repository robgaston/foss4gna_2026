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
import {
    corridorSearchQuery,
    ranchoVegaSearchQuery,
    williamsSearchQuery,
} from "./search-filters.mjs";

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
    await director.goto(`${ARCHES_URL}/search?${corridorSearchQuery()}`, () =>
        waitForSearchResults(page),
    );
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
    await director.goto(`${ARCHES_URL}/report/${RANCHO_VEGA_RESOURCE_ID}`, async () => {
        await page.getByRole("switch", { name: "Hide Null Values" }).click();
        await page.waitForTimeout(600);
    });
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
    await director.caption("Its type comes from a shared vocabulary; its dates are data, not text");
    await pause(3000);
    await smoothScrollTo(page, "Associated People and Organizations");
    await director.caption(
        "But look at who it's connected to: Paul R. Williams, architect, and the Lockheed-Vega plant",
    );
    await pause(4500);
}

export async function followRelationships(studio, director) {
    const { page, pause, glideAndClick } = studio;
    await director.goto(`${ARCHES_URL}/search?${ranchoVegaSearchQuery()}`, () =>
        waitForSearchResults(page),
    );
    await glideAndClick(page.getByText("Related Resources").first());
    await director.caption(
        "Ten labelled relationships: designed by, developed by, housed workers of, identified by, built during, and five sources",
    );
    await pause(5000);

    await director.caption("");
    await director.goto(`${ARCHES_URL}/search?${williamsSearchQuery()}`, () =>
        waitForSearchResults(page),
    );
    await glideAndClick(page.getByText("Related Resources").first());
    await director.caption(
        "Follow the architect: 16 works here, 7 of them LA landmarks. The City's own layer has no architect field",
    );
    await pause(5500);
    await director.caption("This network is what makes Rancho Vega significant");
    await pause(3000);
}

/** Signs in without showing the login page; the director cuts the wait. */
async function signInAsReviewer(page) {
    await page.fill("input[name=username]", REVIEWER_USERNAME);
    await page.press("input[name=username]", "Enter");
    const passwordInput = page.locator("input[name=password]");
    await passwordInput.waitFor({ state: "visible" });
    await passwordInput.fill(DEMO_PASSWORD);
    await passwordInput.press("Enter");
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
}

// Demo step A4, in arches-search's Advanced Search. Core Advanced Search
// can't ask for "no designation tile is an HCM": it matches tile by tile, so
// HCMs that also have a National Register tile slip through.
export async function askWhatAFlatLayerCant(studio, director) {
    const { page, pause, glideTo, glideAndClick } = studio;
    const advancedSearch = encodeURIComponent("/plugins/arches-search/advanced");
    await director.caption("");
    await director.goto(`${ARCHES_URL}/auth/?next=${advancedSearch}`, async () => {
        await signInAsReviewer(page);
        await page.getByText("Select Resource").waitFor();
        await pause(800);
    });
    await director.caption("Which of Williams's works aren't LA landmarks? Ask the graph");

    async function addFilter(nodeLabel, nodeSearch) {
        await glideAndClick(page.getByRole("button", { name: "Add filter" }));
        await glideAndClick(page.getByText("Select node...").last());
        await page.getByPlaceholder("Search nodes...").pressSequentially(nodeSearch, { delay: 40 });
        await glideAndClick(
            page.locator("[data-pc-section='panel']").getByText(nodeLabel, { exact: true }),
        );
        await pause(500);
    }

    await glideAndClick(page.getByText("Select Resource"));
    await glideAndClick(page.getByRole("option", { name: "Monument", exact: true }));

    await director.caption("Monuments where at least one actor is Paul R. Williams...");
    await addFilter("Person or Organization", "Person or");
    const actorClause = page.locator(".clause-builder").nth(0);
    await glideAndClick(actorClause.locator(".clause-operator-select"));
    await glideAndClick(page.getByRole("option", { name: "references any" }));
    await pause(1000);
    const actorPicker = actorClause.locator(".clause-operands-row .p-multiselect");
    const williams = page.getByRole("option", { name: "Paul Revere Williams" });
    // The picker loads its options after opening, and sometimes needs a
    // second click the first time; retry until Williams is there and settled.
    for (let attempt = 1; ; attempt += 1) {
        try {
            if (!(await williams.isVisible())) {
                await glideAndClick(actorPicker);
            }
            await williams.waitFor({ timeout: 5000 });
            await pause(600);
            await glideAndClick(williams);
            break;
        } catch (error) {
            if (attempt === 3) {
                throw error;
            }
            await page.keyboard.press("Escape");
            await pause(800);
        }
    }
    await page.keyboard.press("Escape");
    await pause(600);

    await director.caption("...and no designation is a Historic-Cultural Monument");
    await addFilter("Designation or Protection Type", "Designation or");
    const designationClause = page.locator(".clause-builder").nth(1);
    await glideAndClick(designationClause.locator(".clause-quantifier-select"));
    await glideAndClick(page.getByRole("option", { name: "No", exact: true }));
    await pause(500);
    await glideAndClick(designationClause.locator(".clause-operator-select"));
    await glideAndClick(page.getByRole("option", { name: "references any" }));
    await pause(500);
    await glideAndClick(designationClause.locator(".clause-operands-row .p-treeselect"));
    await glideAndClick(
        page
            .locator("[data-pc-section='panel']")
            .last()
            .getByText("Los Angeles Historic-Cultural Monument", { exact: true }),
    );
    await page.keyboard.press("Escape");
    await pause(600);

    await glideAndClick(page.getByRole("button", { name: "Search", exact: true }));
    const resultCount = page.getByText("9 items match your filter");
    await resultCount.waitFor({ timeout: 30_000 });
    await director.caption(
        "Nine works, and one of them is in our corridor. The City's layer can't answer this; it has no architect",
    );
    await glideTo(resultCount);
    await pause(2500);
    await glideTo(page.getByText("Rancho Vega", { exact: true }).first());
    await pause(3000);
}

export async function reviewInArches(studio, director) {
    const { page, pause, glideAndClick } = studio;
    // Still signed in as the reviewer from step A4.
    await director.caption("Back in Arches, the reviewer opens the plant");
    await director.goto(`${ARCHES_URL}/resource/${PLANT_RESOURCE_ID}`, () =>
        page.waitForLoadState("networkidle"),
    );
    await pause(1500);
    // Geometry sits under the collapsed Location Data card.
    const tree = page.locator(".resource-editor-tree");
    await glideAndClick(tree.getByText("Location Data", { exact: true }).first());
    await pause(1000);
    await glideAndClick(tree.getByText("Geometry", { exact: true }).first());
    await page.getByText("Provisional Edits", { exact: true }).waitFor({ timeout: 30_000 });
    await pause(1000);
    await director.caption("The contributor's footprint is waiting for review");
    await glideAndClick(page.getByText("demo_contributor", { exact: true }).last());
    await page.getByText("Showing edits by demo_contributor").waitFor();
    await pause(1000);
    await glideAndClick(page.getByText("Zoom to all", { exact: true }));
    await pause(2500);
    // Collapse the card form so the map fills the panel. (The map's
    // full-screen control doesn't record, and hides the captions.)
    await glideAndClick(page.locator(".workbench-card-sidebar-tab, [role=tab]").filter({ hasText: "Edit" }).first());
    await pause(1500);
    // Zoom out a step for context, with the wheel: clicks on the map select the feature.
    const map = page.locator(".maplibregl-canvas:visible").first();
    const mapBox = await map.boundingBox();
    await page.mouse.move(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * 0.5, {
        steps: 15,
    });
    await page.mouse.wheel(0, 400);
    await pause(2500);
    await director.caption(
        "A record can exist semantically before it exists spatially, and nobody bypassed governance",
    );
    await pause(3500);
    await director.still("arches-provisional-edit");
    await pause(1500);
}
