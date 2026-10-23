// Shared settings for the demo recording, and the arches-geolibre harness it
// reuses (visible pointer, captions, video capture and MP4 conversion).

import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ARCHES_URL = process.env.ARCHES_URL ?? "http://localhost:8003";
const archesGeolibreDirectory =
    process.env.ARCHES_GEOLIBRE_DIR ??
    path.join(homedir(), "Projects/arches-geolibre");

// The harness reads the Arches URL when it loads.
process.env.ARCHES_TEST_URL = ARCHES_URL;
export const harness = await import(
    path.join(archesGeolibreDirectory, "scripts/demo/harness.mjs")
);
export const { chromium } = createRequire(
    path.join(archesGeolibreDirectory, "package.json"),
)("@playwright/test");

export const DECK_DIRECTORY = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);
export const SCREENSHOT_DIRECTORY = path.join(DECK_DIRECTORY, "assets/screenshots");
export const VIDEO_DIRECTORY = path.join(DECK_DIRECTORY, "assets/video");

export const DEMO_PASSWORD = "foss4gna-demo-password";
export const CONTRIBUTOR_USERNAME = "demo_contributor";
export const REVIEWER_USERNAME = "demo_editor";
export const PASSWORD_CLIENT_ID = "foss4gna-demo-geolibre";

export const RANCHO_VEGA_RESOURCE_ID = "04c47869-64f3-5b50-8f7f-7b2641327812";
export const PLANT_RESOURCE_ID = "b54fe8e0-4754-500c-ac83-32f97df97650";
export const PLANT_NAME = "Lockheed-Vega Aircraft Plant, Burbank";
export const MONUMENT_GEOMETRY_NODE_ID = "87d3d7dc-f44f-11eb-bee9-a87eeabdefba";
export const MONUMENT_LAYER_NAME = "Monument: Geospatial Coordinates";
export const RANCHO_VEGA = { longitude: -118.3602, latitude: 34.1804 };
