# pptx-mcp

Stdio Model Context Protocol server for [pptx.dev](https://www.pptx.dev). Acts as a thin local proxy to the hosted MCP server at `https://mcp.pptx.dev`, so MCP clients (Claude Desktop, Cursor, etc.) can invoke pptx tools over stdio.

> **Status:** Phase 1 scaffold. Not yet published to npm. Full install / configuration docs land in Phase 4 alongside the [`pptx.dev/mcp`](https://www.pptx.dev/mcp) install page.

## How it works

The binary opens a `StdioServerTransport`, connects an MCP client to the remote streamable-HTTP endpoint, and forwards `tools/list` and `tools/call` requests upstream. Tool schemas and behavior are owned by the remote server — this package adds no tool definitions of its own.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `PPTX_API_KEY` | Bearer token forwarded to the remote MCP. Required for every tool except `validate_opf`. | _(unset)_ |
| `PPTX_MCP_REMOTE_URL` | Remote MCP endpoint to proxy to. | `https://mcp.pptx.dev` |

## Local development

```sh
pnpm install
pnpm build
node dist/cli.js   # speaks MCP over stdio
```

## License

MIT — see [LICENSE](./LICENSE).
