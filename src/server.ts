import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  PptxApiError,
  PptxClient,
  PptxRateLimitError,
  PptxValidationError,
  type GenerateFormat,
  type PptxClientOptions,
  type RenderFormat,
} from "./client.js";

export interface CreatePptxMcpServerOptions extends PptxClientOptions {
  name?: string;
  version?: string;
}

const SERVER_NAME = "pptx-mcp";
const SERVER_VERSION = "0.1.0";

const GENERATE_FORMATS = ["pptx", "pdf", "png", "svg"] as const;
const RENDER_FORMATS = ["web", "svg", "png"] as const;

export function createPptxMcpServer(
  options: CreatePptxMcpServerOptions = {},
): McpServer {
  const client = new PptxClient(options);
  const server = new McpServer({
    name: options.name ?? SERVER_NAME,
    version: options.version ?? SERVER_VERSION,
  });

  server.registerTool(
    "generate_presentation",
    {
      title: "Generate a presentation from OPF JSON",
      description:
        "Submit an OPF (Open Presentation Format) document to pptx.dev and receive a generation job. Returns a 202-accepted envelope with job status, slide count, and any validation warnings. Use validate_opf first to catch schema errors client-side.",
      inputSchema: {
        document: z
          .record(z.any())
          .describe(
            "OPF document as a JSON object. Must include $schema, meta, design, and slides.",
          ),
        format: z
          .enum(GENERATE_FORMATS)
          .optional()
          .describe(
            "Target format. Defaults to pptx. Supported: pptx, pdf, png, svg.",
          ),
      },
    },
    async ({ document, format }) => {
      const result = await client.generate(
        document,
        format as GenerateFormat | undefined,
      );
      return toTextResult(result);
    },
  );

  server.registerTool(
    "parse_pptx",
    {
      title: "Parse a .pptx file into OPF JSON",
      description:
        "Upload a .pptx file by local filesystem path or base64 data and get back OPF JSON, or return a parseId for per-slide reads.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe(
            "Absolute filesystem path to a .pptx file. One of path or data is required.",
          ),
        data: z
          .string()
          .optional()
          .describe(
            "Base64-encoded .pptx bytes. One of path or data is required.",
          ),
        filename: z
          .string()
          .optional()
          .describe(
            "Optional filename hint used when data is provided. Defaults to upload.pptx.",
          ),
        mode: z
          .enum(["opf", "parse"])
          .optional()
          .describe(
            "opf (default) converts the deck to OPF JSON. parse uploads and returns a parseId for per-slide reads.",
          ),
      },
    },
    async ({ path, data, filename, mode }) => {
      const file = await loadPptxFile({ path, data, filename });
      const result =
        mode === "parse" ? await client.parse(file) : await client.convert(file);
      return toTextResult(result);
    },
  );

  server.registerTool(
    "validate_opf",
    {
      title: "Validate an OPF document",
      description:
        "Validate an OPF document against the canonical schema at https://pptx.dev/schema/opf/v1. Returns { valid, errors[], warnings[] }. Validation is free and should be run before generate_presentation.",
      inputSchema: {
        document: z.record(z.any()).describe("OPF document as a JSON object."),
      },
    },
    async ({ document }) => {
      const result = await client.validate(document);
      return toTextResult(result);
    },
  );

  server.registerTool(
    "render_format",
    {
      title: "Render a .pptx file to a target format",
      description:
        "Render a .pptx file to web (interactive slides with text runs), svg, or png. web returns slide data and viewerUrl; svg/png return a 202 job acknowledgement.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe(
            "Absolute filesystem path to a .pptx file. One of path or data is required.",
          ),
        data: z
          .string()
          .optional()
          .describe(
            "Base64-encoded .pptx bytes. One of path or data is required.",
          ),
        filename: z.string().optional(),
        format: z
          .enum(RENDER_FORMATS)
          .describe("Target format: web, svg, or png."),
        slides: z
          .array(z.number().int().positive())
          .optional()
          .describe(
            "Optional 1-based slide indices to render. Defaults to all slides.",
          ),
      },
    },
    async ({ path, data, filename, format, slides }) => {
      const file = await loadPptxFile({ path, data, filename });
      const result = await client.render(file, format as RenderFormat, slides);
      return toTextResult(result);
    },
  );

  return server;
}

interface LoadPptxFileArgs {
  path?: string;
  data?: string;
  filename?: string;
}

async function loadPptxFile({
  path,
  data,
  filename,
}: LoadPptxFileArgs): Promise<{ data: Uint8Array; filename: string }> {
  if (path) {
    return {
      data: new Uint8Array(await readFile(path)),
      filename: filename ?? basename(path),
    };
  }
  if (data) {
    return {
      data: new Uint8Array(Buffer.from(data, "base64")),
      filename: filename ?? "upload.pptx",
    };
  }
  throw new Error(
    "pptx-mcp: one of `path` or `data` is required for file-based tools.",
  );
}

function basename(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index >= 0 ? path.slice(index + 1) : path;
}

function toTextResult(value: unknown) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function formatPptxError(err: unknown): string {
  if (err instanceof PptxValidationError) {
    return `OPF schema validation failed (HTTP ${err.status}): ${err.validationErrors.join("; ")}`;
  }
  if (err instanceof PptxRateLimitError) {
    const retry =
      err.retryAfterSeconds !== undefined
        ? ` Retry after ${err.retryAfterSeconds}s.`
        : "";
    return `pptx.dev rate limit exceeded.${retry}`;
  }
  if (err instanceof PptxApiError) {
    return `pptx.dev API error ${err.status}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
