/**
 * Ximo Mall MCP Server - Stdio Entry Point
 *
 * This is the primary entry point for MCP clients that communicate over
 * stdin/stdout (e.g. Claude Desktop, VS Code extensions, etc.).
 *
 * Usage:
 *   npx tsx src/index.ts
 *   # or via npm script:
 *   npm run start:stdio
 */

import { createBananaMallMcpServer } from "./server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main(): Promise<void> {
  const server = createBananaMallMcpServer();
  const transport = new StdioServerTransport();

  // Log to stderr so we don't interfere with the stdio transport
  process.stderr.write(
    `[ximo-mall-mcp] Starting MCP server over stdio...\n`,
  );

  await server.connect(transport);

  process.stderr.write(
    `[ximo-mall-mcp] Server connected and ready.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(
    `[ximo-mall-mcp] Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
