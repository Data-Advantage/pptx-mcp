#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { DEFAULT_API_BASE_URL } from "./client.js";
import { createPptxMcpServer, formatPptxError } from "./server.js";

const API_BASE_URL = process.env.PPTX_API_BASE_URL ?? DEFAULT_API_BASE_URL;

async function main(): Promise<void> {
  const server = createPptxMcpServer({
    apiKey: process.env.PPTX_API_KEY,
    baseUrl: API_BASE_URL,
  });
  await server.connect(new StdioServerTransport());
  process.stderr.write(`pptx-mcp: ready (${API_BASE_URL})\n`);
}

main().catch((err) => {
  process.stderr.write(`pptx-mcp: fatal: ${formatPptxError(err)}\n`);
  process.exit(1);
});
