// The demo pushes real geometry to Arches. These helpers check the
// Lockheed-Vega plant starts with none, track what the plugin writes, and
// remove it afterwards.

import {
    ARCHES_URL,
    DEMO_PASSWORD,
    MONUMENT_GEOMETRY_NODE_ID,
    PASSWORD_CLIENT_ID,
    PLANT_NAME,
    PLANT_RESOURCE_ID,
    REVIEWER_USERNAME,
} from "./config.mjs";

export async function fetchToken(username) {
    const response = await fetch(`${ARCHES_URL}/o/token/`, {
        method: "POST",
        body: new URLSearchParams({
            grant_type: "password",
            client_id: PASSWORD_CLIENT_ID,
            username,
            password: DEMO_PASSWORD,
        }),
    });
    if (!response.ok) {
        throw new Error(
            `Could not sign in to Arches at ${ARCHES_URL} as ${username} (HTTP ${response.status}).`,
        );
    }
    return (await response.json()).access_token;
}

/** Approved geometry only; provisional edits don't appear here. */
export async function plantGeometryFeatureCount() {
    const query = new URLSearchParams({
        nodeid: MONUMENT_GEOMETRY_NODE_ID,
        resourceid: PLANT_RESOURCE_ID,
    });
    const response = await fetch(`${ARCHES_URL}/geojson?${query}`, {
        headers: { Authorization: `Bearer ${await fetchToken(REVIEWER_USERNAME)}` },
    });
    return (await response.json()).features.length;
}

export async function ensurePlantHasNoGeometry() {
    if ((await plantGeometryFeatureCount()) > 0) {
        throw new Error(
            `${PLANT_NAME} already has geometry; run manage.py reset_lockheed_plant first.`,
        );
    }
}

/** Records the tiles the plugin writes, so they can be removed afterwards. */
export function recordGeometryWrites(page) {
    const writes = [];
    page.on("response", async (response) => {
        const request = response.request();
        if (
            request.method() !== "POST" ||
            !response.url().startsWith(`${ARCHES_URL}/api/node_value/`) ||
            !response.ok()
        ) {
            return;
        }
        const body = new URLSearchParams(request.postData() ?? "");
        const savedTile = await response.json();
        writes.push({
            tileId: savedTile.tileid,
            parentTileId: savedTile.parenttile_id ?? savedTile.parenttile ?? null,
            filledExistingTile: body.has("tileid"),
        });
    });
    return writes;
}

export async function undoGeometryWrites(writes) {
    if (writes.length === 0) {
        console.warn("The plugin wrote no geometry tiles, so there's nothing to remove.");
        return;
    }
    const headers = { Authorization: `Bearer ${await fetchToken(REVIEWER_USERNAME)}` };
    for (const write of writes) {
        const response = write.filledExistingTile
            ? await fetch(`${ARCHES_URL}/api/node_value/`, {
                  method: "POST",
                  headers,
                  body: new URLSearchParams({
                      nodeid: MONUMENT_GEOMETRY_NODE_ID,
                      tileid: write.tileId,
                      data: JSON.stringify({ type: "FeatureCollection", features: [] }),
                      transaction_id: crypto.randomUUID(),
                  }),
              })
            : // The push also creates the cardinality-1 Location Data parent;
              // removing it (and its child) leaves the plant as it was.
              await fetch(`${ARCHES_URL}/api/tiles/${write.parentTileId ?? write.tileId}`, {
                  method: "DELETE",
                  headers,
              });
        console.log(
            `Removed demo write ${write.parentTileId ?? write.tileId} (HTTP ${response.status}).`,
        );
    }
}
