# pptx-mcp Product Strategy

## Vision

Make pptx.dev available as a reliable Model Context Protocol server so AI agents can generate, parse, validate, and render presentations through the canonical pptx.dev API.

## Target User

Developers and AI-tool power users who connect Claude Desktop, Cursor, Claude Code, or other MCP-aware clients to presentation workflows. They need local stdio access to pptx.dev without depending on unpublished workspace packages.

## Positioning

`pptx-mcp` is the official standalone MCP package for pptx.dev. It mirrors the legacy OpenPresentation MCP surface while calling the public REST API directly, making it suitable for npm distribution and agent-client installation.

## Current Priorities

- Preserve the legacy MCP tool contract for `generate_presentation`, `parse_pptx`, `validate_opf`, and `render_format`.
- Keep installation simple through `npx pptx-mcp` and a single `PPTX_API_KEY` environment variable.
- Maintain package verification that exercises stdio MCP behavior against a mock pptx.dev API.
- Publish only from tagged releases after typecheck, build, verification, and package validation pass.

## Key Decisions

- The server talks to `https://api.pptx.dev/v1` by default and supports `PPTX_API_BASE_URL` for local or staging API testing.
- The package does not depend on the unpublished `@pptx/sdk` workspace package.
- `validate_opf` remains usable without an API key; other tools require bearer authentication.
- Hosted HTTP MCP remains separate from this package; this repository owns the standalone stdio package.
