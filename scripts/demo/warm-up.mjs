// Opens every page linked from the demo instance's home page, signed out (as
// the live demo runs) and then as the reviewer: a smoke test before a
// rehearsal or the talk that also warms the server. Fails if a page doesn't
// load or throws an error. (It runs its own browser, so open the demo tabs
// yourself to warm your browser's cache.)
//
//   node scripts/demo/warm-up.mjs
//
//   ARCHES_URL  default http://localhost:8003

import { ARCHES_URL, DEMO_PASSWORD, REVIEWER_USERNAME, chromium } from "./config.mjs";

async function signInAsReviewer(page) {
    await page.goto(`${ARCHES_URL}/auth/`);
    await page.fill("input[name=username]", REVIEWER_USERNAME);
    await page.press("input[name=username]", "Enter");
    await page.locator("input[name=password]").waitFor({ state: "visible" });
    await page.fill("input[name=password]", DEMO_PASSWORD);
    await page.press("input[name=password]", "Enter");
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"));
}

async function visitDemoPages(page, visitor) {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));

    await page.goto(`${ARCHES_URL}/`);
    const demoPages = await page
        .locator("main a")
        .evaluateAll((anchors) => [...new Set(anchors.map((anchor) => anchor.href))]);
    console.log(visitor);
    for (const url of demoPages) {
        const started = Date.now();
        const response = await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const outcome = new URL(page.url()).pathname.startsWith("/auth")
            ? "sign-in required"
            : response.status();
        console.log(`${seconds.padStart(5)} s  ${outcome}  ${url.replace(ARCHES_URL, "")}`);
        if (!response.ok()) {
            process.exitCode = 1;
        }
    }
    if (pageErrors.length > 0) {
        console.error(`Page errors:\n${pageErrors.join("\n")}`);
        process.exitCode = 1;
    }
}

const browser = await chromium.launch();
try {
    const viewport = { width: 1280, height: 720 };
    await visitDemoPages(await browser.newPage({ viewport }), "Signed out");
    const reviewerPage = await browser.newPage({ viewport });
    await signInAsReviewer(reviewerPage);
    await visitDemoPages(reviewerPage, `Signed in as ${REVIEWER_USERNAME}`);
} finally {
    await browser.close();
}
