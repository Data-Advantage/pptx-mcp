import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";

const api = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method !== "POST" || url.pathname !== "/v1/validate") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: { code: "not_found", message: "not found" } }),
    );
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  const document = JSON.parse(body);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      valid: document?.$schema === "https://pptx.dev/schema/opf/v1",
      errors: [],
      warnings: [],
    }),
  );
});

await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
const address = api.address();
if (!address || typeof address === "string") {
  throw new Error("verify: failed to start local mock API");
}
const apiBaseUrl = `http://127.0.0.1:${address.port}`;

const child = spawn(process.execPath, ["dist/cli.js"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    PPTX_API_BASE_URL: apiBaseUrl,
    PPTX_API_KEY: "verify-token",
  },
});

const rl = createInterface({ input: child.stdout });
const pending = new Map();

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    console.error("[verify] non-JSON line:", line);
    return;
  }
  if (msg.id != null && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else {
    console.error("[verify] notification:", JSON.stringify(msg));
  }
});

function send(method, params, id) {
  const payload = { jsonrpc: "2.0", method, ...(params ? { params } : {}) };
  if (id != null) payload.id = id;
  child.stdin.write(JSON.stringify(payload) + "\n");
}

function request(method, params, id) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`verify: timed out waiting for ${method}`));
    }, 5000);
    pending.set(id, (msg) => {
      clearTimeout(timeout);
      resolve(msg);
    });
    send(method, params, id);
  });
}

const sample = {
  $schema: "https://pptx.dev/schema/opf/v1",
  version: "1.0.0",
  meta: { title: "verify" },
  design: { theme: "minimal" },
  slides: [{ layout: "title", elements: [] }],
};

try {
  const init = await request(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "verify", version: "0" },
    },
    1,
  );
  console.log("initialize:", JSON.stringify(init.result?.serverInfo ?? init));

  send("notifications/initialized");

  const list = await request("tools/list", {}, 2);
  const names = list.result?.tools?.map((t) => t.name) ?? [];
  console.log("tools/list:", names);
  for (const expected of [
    "generate_presentation",
    "parse_pptx",
    "validate_opf",
    "render_format",
  ]) {
    if (!names.includes(expected)) {
      throw new Error(`verify: missing tool ${expected}`);
    }
  }

  const call = await request(
    "tools/call",
    { name: "validate_opf", arguments: { document: sample } },
    3,
  );
  const text = call.result?.content?.[0]?.text ?? JSON.stringify(call);
  console.log("validate_opf:", text.slice(0, 400));
} finally {
  child.stdin.end();
  const exit = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve("timeout");
    }, 5000);
    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
  await new Promise((resolve) => api.close(resolve));
  if (exit === "timeout") {
    throw new Error("verify: MCP server did not exit after stdin closed");
  }
}
