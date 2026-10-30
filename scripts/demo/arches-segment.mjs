// The Arches parts of the demo recording: screen a corridor in arches-search,
// open Rancho Vega, follow its relationships to Paul R. Williams (the core
// graph, on the demo's standalone related-resources page), ask the "not
// landmarks" question in arches-search, and (at the end) review the GeoLibre
// edit as a reviewer.

import {
    ARCHES_URL,
    DEMO_PASSWORD,
    PLANT_RESOURCE_ID,
    RANCHO_VEGA_RESOURCE_ID,
    REVIEWER_USERNAME,
    WILLIAMS_RESOURCE_ID,
} from "./config.mjs";
import {
    ADVANCED_SEARCH_PATH,
    CORRIDOR_BUFFER_METERS,
    CORRIDOR_VIEW,
    OXNARD_STREET_LATITUDE,
    SIMPLE_SEARCH_PATH,
} from "./search-filters.mjs";

/**
 * Finds the MapLibre map behind arches-search's Vue MapComponent, so the
 * pointer can be placed on real coordinates. Returns the map canvas's box.
 */
async function exposeSearchMap(page) {
    return page.evaluate(() => {
        let component = document.querySelector(".maplibregl-map")?.__vueParentComponent;
        while (component && !component.exposed?.map) {
            component = component.parent;
        }
        const map = component?.exposed?.map;
        window.demoSearchMap = map?.value ?? map;
        return window.demoSearchMap.getCanvas().getBoundingClientRect().toJSON();
    });
}

async function searchMapScreenPoint(page, lngLat) {
    return page.evaluate((point) => {
        const projected = window.demoSearchMap.project(point);
        const canvas = window.demoSearchMap.getCanvas().getBoundingClientRect();
        return { x: canvas.left + projected.x, y: canvas.top + projected.y };
    }, lngLat);
}

export async function screenCorridor(studio, director) {
    const { page, pause, glideTo, glideAndClick } = studio;
    // Steps A1-A4 run signed out, as the public sees them; the reviewer signs
    // in only for the review at the end.
    await director.goto(`${ARCHES_URL}${SIMPLE_SEARCH_PATH}`, async () => {
        await page.getByRole("button", { name: "Map", exact: true }).waitFor();
        await pause(800);
    });
    await director.caption(
        "Screen a hypothetical utility corridor along Oxnard Street, North Hollywood",
    );
    // Monuments only: the corridor is itself an Area record, so it would match too.
    await glideAndClick(
        page.locator(".type-btn").filter({ has: page.locator(".type-label", { hasText: /^Monument$/ }) }),
    );
    await pause(1500);
    await glideAndClick(page.getByRole("button", { name: "Map", exact: true }));
    // The map opens with its Map Tools panel showing.
    const mapToolsPanel = page.locator("section[aria-label='Map Tools']");
    await mapToolsPanel.waitFor();
    await pause(2000);

    // Fly to the corridor, centered in the part of the map the tools panel leaves visible.
    const canvas = await exposeSearchMap(page);
    // The tools panel overlays the map's left side.
    const toolsPanelBox = await mapToolsPanel.boundingBox();
    const visibleLeft = toolsPanelBox.x + toolsPanelBox.width + 20;
    // Leave room for the place search and zoom controls on the right.
    const visibleRight = canvas.right - 60;
    const visibleCenterX = (visibleLeft + visibleRight) / 2;
    await page.evaluate(
        ({ view, offsetX }) =>
            window.demoSearchMap.flyTo({ ...view, offset: [offsetX, 0], duration: 3500 }),
        { view: CORRIDOR_VIEW, offsetX: visibleCenterX - (canvas.left + canvas.width / 2) },
    );
    await pause(4000);

    await director.caption("Draw the corridor's centerline...");
    await glideAndClick(mapToolsPanel.getByRole("button", { name: "Line", exact: true }));
    await pause(500);
    const oxnard = await searchMapScreenPoint(page, [CORRIDOR_VIEW.center[0], OXNARD_STREET_LATITUDE]);
    const lineStart = { x: visibleLeft + 5, y: oxnard.y };
    const lineEnd = { x: visibleRight - 5, y: oxnard.y };
    await page.mouse.move(lineStart.x, lineStart.y, { steps: 20 });
    await page.mouse.click(lineStart.x, lineStart.y);
    await pause(300);
    await page.mouse.move(lineEnd.x, lineEnd.y, { steps: 40 });
    await page.mouse.dblclick(lineEnd.x, lineEnd.y);
    // The map zooms to the finished line.
    await pause(2000);

    // The buffer's default distance is the corridor's 100 m.
    await director.caption(`...and buffer it ${CORRIDOR_BUFFER_METERS} m`);
    await glideAndClick(mapToolsPanel.locator(".geometry-buffer-toggle").first());
    const oneResult = page.getByText(/^1 results?$/);
    await oneResult.waitFor({ timeout: 30_000 });
    await pause(1500);
    // Close the tools panel to show the whole corridor.
    await glideAndClick(mapToolsPanel.getByRole("button", { name: "Close panel" }));
    await pause(1500);
    await director.caption(
        "One inventoried resource is in the way: Rancho Vega. It isn't a designated landmark",
    );
    await glideTo(page.getByText("Rancho Vega", { exact: true }).first());
    await pause(3000);
    await pause(500);
}

// Demo step A2: Rancho Vega's report, an arches-modular-reports report
// configured in the demo project (header, key facts, footprint map, tabs).
export async function openRanchoVega(studio, director) {
    const { page, pause, glideTo, glideAndClick } = studio;
    await director.caption("");
    await director.goto(`${ARCHES_URL}/report/${RANCHO_VEGA_RESOURCE_ID}`, async () => {
        await page.locator(".report-map .maplibregl-canvas").waitFor({ timeout: 30_000 });
        await pause(2500);
    });
    await director.caption(
        "On its own, an unremarkable record: 21 garden apartment buildings and their garages, built 1945",
    );
    await glideTo(page.locator(".report-map"));
    await pause(2500);
    await pause(1500);
    await director.caption("Its type comes from a shared vocabulary; its dates are data, not text");
    // The section shortcuts under each tab are anchors without an href.
    await glideAndClick(
        page.locator(".linked-section-button-container a").filter({ hasText: /^Construction$/ }).first(),
    );
    await pause(3500);
    await director.caption(
        "But look at who it's connected to: Paul R. Williams, architect, and the Lockheed-Vega plant",
    );
    await glideAndClick(page.getByRole("tab", { name: "People and context" }));
    await page.getByText("Architect", { exact: true }).first().waitFor({ timeout: 15_000 });
    await pause(1000);
    await glideTo(page.getByRole("link", { name: "Paul Revere Williams" }).first());
    await pause(2500);
    await pause(2000);
}

/**
 * Where a resource's node is in the related-resources graph. Cytoscape keeps
 * its instance on the container element.
 */
async function graphNodeScreenPoint(page, resourceId) {
    return page.evaluate((nodeId) => {
        const container = [...document.querySelectorAll("div")].find((element) => element._cyreg?.cy);
        const node = container._cyreg.cy.getElementById(nodeId);
        const position = node.renderedPosition();
        const box = container.getBoundingClientRect();
        return { x: box.left + position.x, y: box.top + position.y };
    }, resourceId);
}

// Demo step A3: the core related-resources graph, opened from an arches-search
// result through the demo's standalone related-resources plugin.
export async function followRelationships(studio, director) {
    const { page, pause, glideTo, glideAndClick, typeInto } = studio;
    await director.caption("");
    await director.goto(`${ARCHES_URL}${SIMPLE_SEARCH_PATH}`, () =>
        page.getByPlaceholder(/Search places, people/).waitFor(),
    );
    await typeInto(page.getByPlaceholder(/Search places, people/), "Rancho Vega", 60);
    await page.keyboard.press("Enter");
    const ranchoVegaRelated = page
        .locator(".descriptor-section")
        .filter({ has: page.getByRole("link", { name: "Rancho Vega", exact: true }) })
        .locator("a.descriptor-section-related-action")
        .first();
    await ranchoVegaRelated.waitFor({ timeout: 30_000 });
    await pause(1000);
    await director.caption("Every result links to its relationship graph");
    await glideTo(ranchoVegaRelated);
    await pause(1500);
    // The link opens a new tab, which the recording can't follow; load it here instead.
    await director.goto(`${ARCHES_URL}${await ranchoVegaRelated.getAttribute("href")}`, () =>
        pause(4500),
    );
    await director.caption(
        "Fifteen labelled relationships: designed by, developed by, housed workers of, identified by, built during, in the path of, and nine sources",
    );
    await pause(5000);

    await director.caption("Re-center the graph on the architect");
    await glideAndClick(page.locator(".ion-asterisk").first());
    await pause(800);
    const williams = await graphNodeScreenPoint(page, WILLIAMS_RESOURCE_ID);
    await page.mouse.move(williams.x, williams.y, { steps: 25 });
    await pause(400);
    await page.mouse.click(williams.x, williams.y);
    await page.waitForURL(`**resourceid=${WILLIAMS_RESOURCE_ID}`, { timeout: 15_000 });
    await pause(4000);
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
    await director.caption("");
    // Signed out, like steps A1-A3.
    await director.goto(`${ARCHES_URL}${ADVANCED_SEARCH_PATH}`, async () => {
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

    // The same question in SQL this room already knows: "no designation is
    // an HCM" compiles to NOT EXISTS over the whole resource.
    await glideAndClick(page.getByRole("button", { name: "Describe Query" }));
    const sqlText = page.getByRole("tabpanel", { name: "SQL" }).getByRole("textbox");
    await sqlText.waitFor({ timeout: 30_000 });
    await director.caption("Under the hood: \"no designation is an HCM\" is a NOT EXISTS in SQL");
    await sqlText.evaluate((textarea) => {
        const start = textarea.value.search(/not exists/i);
        const lineNumber = textarea.value.slice(0, start).split("\n").length;
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
        textarea.scrollTop = Math.max(0, (lineNumber - 6) * lineHeight);
        textarea.focus();
        textarea.setSelectionRange(start, start + "NOT EXISTS".length);
    });
    await pause(5000);
    await page.keyboard.press("Escape");
    await pause(800);
}

export async function reviewInArches(studio, director) {
    const { page, pause, glideAndClick } = studio;
    await director.caption("Back in Arches, the reviewer opens the plant");
    const plantEditorPath = `/resource/${PLANT_RESOURCE_ID}`;
    await director.goto(`${ARCHES_URL}/auth/?next=${encodeURIComponent(plantEditorPath)}`, async () => {
        await signInAsReviewer(page);
        await page.waitForLoadState("networkidle");
    });
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
    await pause(1500);
}
