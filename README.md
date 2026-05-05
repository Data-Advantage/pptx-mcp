# pptx-mcp

Official Model Context Protocol server for [pptx.dev](https://www.pptx.dev). It exposes the canonical pptx.dev presentation tools over stdio for Claude Desktop, Cursor, Claude Code, and any MCP-aware client.

The server is a standalone package. It calls the REST API at `https://api.pptx.dev/v1` directly and does not depend on the unpublished `@pptx/sdk` workspace package.

## Tools

| Tool | What it does |
| --- | --- |
| `generate_presentation` | Submit an OPF document and receive a generation job with slide count and validation warnings. |
| `parse_pptx` | Convert a `.pptx` file into OPF JSON, or upload it and return a `parseId` for per-slide reads. |
| `validate_opf` | Validate an OPF document against the canonical schema. Validation is free. |
| `render_format` | Render a `.pptx` file to `web`, `svg`, or `png`. |

File tools accept either an absolute local filesystem `path` or base64 `data`.

## Install / run

Run the latest version directly with `npx`:

```sh
PPTX_API_KEY=ppx_your_key_here npx pptx-mcp
```

Or install globally:

```sh
npm install -g pptx-mcp
PPTX_API_KEY=ppx_your_key_here pptx-mcp
```

The binary speaks MCP over stdio. Point your MCP client at `pptx-mcp`.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["-y", "pptx-mcp"],
      "env": { "PPTX_API_KEY": "ppx_your_key_here" }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` or a project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["-y", "pptx-mcp"],
      "env": { "PPTX_API_KEY": "ppx_your_key_here" }
    }
  }
}
```

### Remote HTTP transport

The hosted MCP endpoint remains available for clients that support HTTP streaming:

```text
https://mcp.pptx.dev
```

Pass your pptx.dev API key as `Authorization: Bearer ppx_your_key_here`.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `PPTX_API_KEY` | Bearer token for `api.pptx.dev`. Required for every tool except `validate_opf`. | _(unset)_ |
| `PPTX_API_BASE_URL` | API origin override for local or staging development. Paths are always `/v1/...`. | `https://api.pptx.dev` |

## Programmatic use

```ts
import { createPptxMcpServer } from "pptx-mcp";

const server = createPptxMcpServer({
  apiKey: process.env.PPTX_API_KEY,
});

await server.connect(transport);
```

## Local development

```sh
pnpm install
pnpm build
pnpm verify
node dist/cli.js   # speaks MCP over stdio
```

`pnpm verify` starts a local mock pptx.dev API, launches `dist/cli.js`, lists the MCP tools, and validates a sample OPF document through stdio.

## Releasing

Releases are driven by git tags matching `v<version>`. The `.github/workflows/publish.yml` workflow installs dependencies, typechecks, builds, verifies the package, checks that the tag matches `package.json`, and publishes to npm with provenance.

The `workflow_dispatch` entrypoint supports a `dry_run` toggle for rehearsals. Do not publish from a feature branch.

## License

MIT — see [LICENSE](./LICENSE).
