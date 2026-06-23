#!/usr/bin/env node
// Entry point for the AEE MCP server. Register this with a coding agent's MCP config
// (see docs/mcp-tools.md). It speaks MCP over stdio and runs investigations on the
// configured model — local by default (AEE_LLM_PROVIDER=local).
import { startServer } from "./index.js";

startServer().catch((error) => {
  console.error("[aee-mcp] failed to start:", error);
  process.exitCode = 1;
});
