# pptx-mcp

Official **Model Context Protocol** server for [pptx.dev](https://www.pptx.dev) — run locally over **stdio** so Claude Desktop, Cursor, Continue, and any MCP-capable client can generate, parse, validate, and render PowerPoint presentations. Calls are proxied to the hosted REST API at `https://api.pptx.dev/v1` using your API key.

Do not need a local Node install? Use the **remote** MCP endpoint instead (no npm): [`https://www.pptx.dev/mcp`](https://www.pptx.dev/mcp) or [`https://mcp.pptx.dev`](https://mcp.pptx.dev) with your bearer token — see [install docs](https://www.pptx.dev/mcp).

## Tools

| Tool | Description |
| --- | --- |
| `generate_presentation` | Submit an OPF document; receive a generation job (status, slide count, warnings). |
| `parse_pptx` | Convert a `.pptx` to OPF JSON (or a `parseId` for per-slide reads). Local stdio accepts filesystem paths; remote hosted MCP accepts base64 only. |
| `validate_opf` | Validate OPF against the canonical schema. **Always free.** |
| `render_format` | Render a `.pptx` to `web`, `svg`, or `png`. |

## Install

### npm (recommended)

```sh
npx pptx-mcp
```

Pin a version or install globally:

```sh
npx pptx-mcp@latest
npm install -g pptx-mcp
pptx-mcp
```

### Docker

```sh
docker run --rm -i \
  -e PPTX_API_KEY=ppx_your_key_here \
  ghcr.io/data-advantage/pptx-mcp:latest
```

Use the same image tag your release notes recommend if it differs.

## Authentication

Create a **`ppx_…`** API key in the pptx.dev dashboard: **[API Keys](https://www.pptx.dev/account/api-keys)**.

| Variable | Purpose |
| --- | --- |
| `PPTX_API_KEY` | Required for every tool except `validate_opf`. |
| `PPTX_API_BASE_URL` | Optional override (default `https://api.pptx.dev`). |

## Configure

### Claude Desktop

`claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["-y", "pptx-mcp"],
      "env": {
        "PPTX_API_KEY": "ppx_your_key_here"
      }
    }
  }
}
```

**Docker** variant:

```json
{
  "mcpServers": {
    "pptx": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "PPTX_API_KEY",
        "ghcr.io/data-advantage/pptx-mcp:latest"
      ],
      "env": {
        "PPTX_API_KEY": "ppx_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after editing.

### Cursor

`~/.cursor/mcp.json` or project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["-y", "pptx-mcp"],
      "env": {
        "PPTX_API_KEY": "ppx_your_key_here"
      }
    }
  }
}
```

**Docker** variant:

```json
{
  "mcpServers": {
    "pptx": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "PPTX_API_KEY",
        "ghcr.io/data-advantage/pptx-mcp:latest"
      ],
      "env": {
        "PPTX_API_KEY": "ppx_your_key_here"
      }
    }
  }
}
```

### Continue

Add to `~/.continue/config.yaml` (or a file under `.continue/mcpServers/` with `name` / `version` / `schema` headers per [Continue MCP](https://docs.continue.dev/customize/deep-dives/mcp)):

```yaml
mcpServers:
  - name: pptx
    command: npx
    args:
      - "-y"
      - "pptx-mcp"
    env:
      PPTX_API_KEY: ppx_your_key_here
```

Use **agent mode** so tools are available.

## Remote MCP (hosted)

Prefer not to install anything? Point your client at the HTTP streaming endpoint and send `Authorization: Bearer ppx_…`:

- `https://www.pptx.dev/mcp`
- `https://mcp.pptx.dev` (alias)

Claude Desktop can use `mcp-remote`:

```json
{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://www.pptx.dev/mcp",
        "--header",
        "Authorization: Bearer ppx_your_key_here"
      ]
    }
  }
}
```

Full copy-paste examples: **[pptx.dev/mcp](https://www.pptx.dev/mcp)**.

## Example

> Generate a pptx with one title slide that says "Q1 Review" and return the job metadata.

The model calls `generate_presentation` with OPF similar to:

```json
{
  "$schema": "https://pptx.dev/schema/opf/v1",
  "version": "1.0",
  "meta": { "title": "Q1 Review", "filename": "q1-review" },
  "design": { "theme": "corporate-minimal" },
  "slides": [
    {
      "id": "title",
      "layout": "title-slide",
      "elements": [
        { "id": "h1", "type": "text", "content": { "text": "Q1 Review" } }
      ]
    }
  ]
}
```

## Programmatic use

```ts
import { createPptxMcpServer } from "pptx-mcp";

const server = createPptxMcpServer({
  apiKey: process.env.PPTX_API_KEY,
});

await server.connect(myTransport);
```

## References

- Install & hosted vs local: [pptx.dev/mcp](https://www.pptx.dev/mcp)
- REST API: [pptx.dev/docs](https://www.pptx.dev/docs)
- OPF schema: `https://pptx.dev/schema/opf/v1`
- TypeScript SDK: [`@pptx/sdk`](https://www.npmjs.com/package/@pptx/sdk)
- MCP spec: [modelcontextprotocol.io](https://modelcontextprotocol.io)

## License

MIT — see [LICENSE](./LICENSE) when present in this repository.
