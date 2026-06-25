#!/usr/bin/env node
import { startTriageServer } from "./index.js";

// Loads the latest persisted run from AEE_STORE_DIR (if set) and serves the triage UI.
const server = await startTriageServer();
console.log(`AEE triage UI → ${server.url}`);
if (!process.env.AEE_STORE_DIR) {
  console.log(
    "(No AEE_STORE_DIR set — showing an empty report. Run investigate with AEE_STORE_DIR set, then start triage with the same directory.)",
  );
}
