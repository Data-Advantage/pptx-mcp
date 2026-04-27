import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SERVER_NAME = "pptx-mcp";
const SERVER_VERSION = "0.1.0";

const REMOTE_URL = process.env.PPTX_MCP_REMOTE_URL ?? "https://mcp.pptx.dev";
const API_KEY = process.env.PPTX_API_KEY;

function logStderr(...args: unknown[]): void {
  // stdout is reserved for MCP protocol traffic.
  console.error("[pptx-mcp]", ...args);
}

async function main(): Promise<void> {
  const remoteUrl = new URL(REMOTE_URL);

  const clientTransport = new StreamableHTTPClientTransport(remoteUrl, {
    requestInit: API_KEY
      ? { headers: { authorization: `Bearer ${API_KEY}` } }
      : {},
  });

  const upstream = new Client(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: {} },
  );

  await upstream.connect(clientTransport);
  logStderr(`connected to remote ${remoteUrl.toString()}`);

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async (req) => {
    return await upstream.listTools(req.params);
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    return await upstream.callTool(req.params);
  });

  // Propagate upstream close to local transport so the host knows we're gone.
  upstream.onclose = () => {
    logStderr("remote transport closed; shutting down");
    process.exit(0);
  };

  await server.connect(new StdioServerTransport());
  logStderr("stdio transport ready");
}

main().catch((err) => {
  logStderr("fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
