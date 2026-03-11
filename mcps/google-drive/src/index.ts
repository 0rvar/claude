#!/usr/bin/env bun

import { McpServer } from "./mcp";
import { runAuthFlow } from "./auth";
import { registerAllTools } from "./tools/index";
import { logger } from "./logger";

const server = new McpServer({
  name: "google-drive-mcp",
  version: "0.1.0",
});
registerAllTools(server);

const subcommand = process.argv[2];

if (subcommand === "auth") {
  try {
    await runAuthFlow();
    logger.info("Authorization complete. You can now start the MCP server.");
    process.exit(0);
  } catch (error: any) {
    logger.error("Authorization failed:", error.message || error);
    process.exit(1);
  }
} else if (subcommand === "tools") {
  for (const [name, tool] of server.tools) {
    console.log(`  ${name.padEnd(22)} ${tool.description}`);
  }
  process.exit(0);
} else if (subcommand && subcommand !== "serve") {
  // CLI mode: run a tool directly
  // Usage: bun run src/index.ts <toolName> [key=value ...]
  const toolName = subcommand;
  const tool = server.tools.get(toolName);
  if (!tool) {
    console.error(`Unknown tool: ${toolName}`);
    console.error(`Run with 'tools' to list available tools.`);
    process.exit(1);
  }

  // Parse args: key=value pairs or a single JSON argument
  const rawArgs = process.argv.slice(3);
  let args: Record<string, any> = {};

  if (rawArgs.length === 1 && rawArgs[0].startsWith("{")) {
    args = JSON.parse(rawArgs[0]);
  } else {
    for (const arg of rawArgs) {
      const eq = arg.indexOf("=");
      if (eq === -1) {
        console.error(`Invalid argument: ${arg} (expected key=value)`);
        process.exit(1);
      }
      const key = arg.slice(0, eq);
      const raw = arg.slice(eq + 1);
      // Try to parse as JSON for booleans/numbers, fall back to string
      try {
        args[key] = JSON.parse(raw);
      } catch {
        args[key] = raw;
      }
    }
  }

  try {
    const parsed = tool.parameters.parse(args);
    const result = await tool.execute(parsed);
    console.log(result);
  } catch (err: any) {
    console.error(err.message ?? err);
    process.exit(1);
  }
  process.exit(0);
} else {
  // MCP stdio server mode (default or explicit "serve")
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Promise Rejection:", reason);
  });
  await server.start();
}
