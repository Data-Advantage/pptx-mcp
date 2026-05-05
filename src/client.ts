export const DEFAULT_API_BASE_URL = "https://api.pptx.dev";

export type GenerateFormat = "pptx" | "pdf" | "png" | "svg";
export type RenderFormat = "web" | "svg" | "png";

export interface PptxFile {
  data: Uint8Array;
  filename?: string;
}

export interface PptxClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | boolean | undefined | string[]>;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
}

export interface PptxApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface PptxApiErrorBody {
  error?: PptxApiErrorEnvelope;
  [key: string]: unknown;
}

export class PptxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PptxError";
  }
}

export class PptxNetworkError extends PptxError {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "PptxNetworkError";
    this.cause = cause;
  }
}

export class PptxApiError extends PptxError {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  readonly requestId: string | undefined;
  readonly body: PptxApiErrorBody | string | null;

  constructor(
    message: string,
    status: number,
    body: PptxApiErrorBody | string | null,
    requestId?: string,
  ) {
    super(message);
    this.name = "PptxApiError";
    this.status = status;
    this.body = body;
    const envelope =
      body && typeof body === "object" && typeof body.error === "object"
        ? body.error
        : undefined;
    this.code = envelope?.code;
    this.details = envelope?.details;
    this.requestId = requestId ?? envelope?.requestId;
  }
}

export class PptxValidationError extends PptxApiError {
  readonly validationErrors: string[];

  constructor(
    message: string,
    status: number,
    body: PptxApiErrorBody | null,
    requestId: string | undefined,
    validationErrors: string[],
  ) {
    super(message, status, body, requestId);
    this.name = "PptxValidationError";
    this.validationErrors = validationErrors;
  }
}

export class PptxRateLimitError extends PptxApiError {
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    body: PptxApiErrorBody | null,
    requestId: string | undefined,
    retryAfterSeconds: number | undefined,
  ) {
    super(message, 429, body, requestId);
    this.name = "PptxRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PptxClient {
  readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(options: PptxClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.PPTX_API_KEY;
    this.baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
    if (options.fetch) {
      this.fetchFn = options.fetch;
    } else if (typeof fetch === "function") {
      this.fetchFn = fetch;
    } else {
      throw new Error("pptx-mcp: no global fetch available");
    }
  }

  async validate(document: Record<string, unknown>): Promise<unknown> {
    return this.request({
      method: "POST",
      path: "/v1/validate",
      body: document,
    });
  }

  async generate(
    document: Record<string, unknown>,
    format?: GenerateFormat,
  ): Promise<unknown> {
    return this.request({
      method: "POST",
      path: "/v1/generate",
      query: format ? { format } : undefined,
      body: document,
    });
  }

  async parse(file: PptxFile): Promise<unknown> {
    const form = new FormData();
    const { blob, filename } = toFilePart(file);
    form.append("file", blob, filename);
    return this.request({
      method: "POST",
      path: "/v1/parse",
      formData: form,
    });
  }

  async convert(file: PptxFile): Promise<unknown> {
    const form = new FormData();
    const { blob, filename } = toFilePart(file);
    form.append("file", blob, filename);
    return this.request({
      method: "POST",
      path: "/v1/convert",
      formData: form,
    });
  }

  async render(
    file: PptxFile,
    format: RenderFormat,
    slides?: number[],
  ): Promise<unknown> {
    const form = new FormData();
    const { blob, filename } = toFilePart(file);
    form.append("file", blob, filename);
    return this.request({
      method: "POST",
      path: "/v1/render",
      query: {
        format,
        slides: slides && slides.length > 0 ? slides.map(String) : undefined,
      },
      formData: form,
    });
  }

  private async request<T = unknown>(options: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, options.path, options.query);
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    let body: FormData | string | undefined;
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body =
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: options.method,
        headers,
        body,
      });
    } catch (cause) {
      throw new PptxNetworkError(
        `pptx-mcp: network error calling ${options.method} ${url}`,
        cause,
      );
    }

    if (!response.ok) {
      await throwApiError(response);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new PptxNetworkError(
        `pptx-mcp: invalid JSON response from ${options.method} ${url}`,
        cause,
      );
    }
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions["query"],
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${cleanPath}`);
  if (!query) return url.toString();

  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      if (raw.length > 0) url.searchParams.set(key, raw.join(","));
    } else {
      url.searchParams.set(key, String(raw));
    }
  }
  return url.toString();
}

function toFilePart(file: PptxFile): { blob: Blob; filename: string } {
  const type =
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const bytes = new Uint8Array(file.data);
  return {
    blob: new Blob([bytes.buffer], { type }),
    filename: file.filename ?? "upload.pptx",
  };
}

async function throwApiError(response: Response): Promise<never> {
  const body = await parseErrorBody(response);
  const requestId =
    response.headers.get("x-request-id") ??
    (typeof body === "object" ? apiErrorEnvelope(body)?.requestId : undefined);

  if (response.status === 422) {
    const validationErrors = validationErrorsFromBody(body);
    if (validationErrors) {
      throw new PptxValidationError(
        errorMessage(response.status, body),
        response.status,
        typeof body === "object" ? body : null,
        requestId,
        validationErrors,
      );
    }
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfter
      ? Number.parseInt(retryAfter, 10)
      : undefined;
    throw new PptxRateLimitError(
      errorMessage(response.status, body),
      typeof body === "object" ? body : null,
      requestId,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    );
  }

  throw new PptxApiError(
    errorMessage(response.status, body),
    response.status,
    body,
    requestId,
  );
}

async function parseErrorBody(
  response: Response,
): Promise<PptxApiErrorBody | string | null> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as PptxApiErrorBody;
  } catch {
    return text;
  }
}

function apiErrorEnvelope(
  body: PptxApiErrorBody | string | null,
): PptxApiErrorEnvelope | undefined {
  if (
    body &&
    typeof body === "object" &&
    body.error &&
    typeof body.error === "object" &&
    typeof body.error.message === "string"
  ) {
    return body.error;
  }
  return undefined;
}

function errorMessage(
  status: number,
  body: PptxApiErrorBody | string | null,
): string {
  const envelope = apiErrorEnvelope(body);
  if (envelope) return `pptx.dev API ${status}: ${envelope.message}`;
  if (typeof body === "string" && body.length > 0) {
    return `pptx.dev API ${status}: ${body}`;
  }
  return `pptx.dev API ${status}`;
}

function validationErrorsFromBody(
  body: PptxApiErrorBody | string | null,
): string[] | null {
  const envelope = apiErrorEnvelope(body);
  const details = envelope?.details as { errors?: unknown } | undefined;
  if (!details || !Array.isArray(details.errors)) return null;

  return details.errors.map((issue) => {
    if (typeof issue === "string") return issue;
    if (
      issue &&
      typeof issue === "object" &&
      typeof issue.path === "string" &&
      typeof issue.message === "string"
    ) {
      return `${issue.path}: ${issue.message}`;
    }
    return String(issue);
  });
}
