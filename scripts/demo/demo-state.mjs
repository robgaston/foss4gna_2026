// The demo pushes real geometry to Arches. The demo project's
// reset_demo_state command removes it again (and any other provisional edit),
// so each recording starts and ends from the same state.

import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

const demoProjectDirectory =
    process.env.DEMO_PROJECT_DIR ?? path.join(homedir(), "Projects/arches4/foss4gna-demo");
const demoPython =
    process.env.DEMO_PYTHON ??
    path.join(homedir(), "Projects/arches4/foss4gna_demo_env/bin/python");

export function resetDemoState() {
    execFileSync(demoPython, ["manage.py", "reset_demo_state"], {
        cwd: demoProjectDirectory,
        stdio: ["ignore", "inherit", "inherit"],
    });
}
