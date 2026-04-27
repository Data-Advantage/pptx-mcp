// Local verification harness — spawns dist/cli.js, drives stdio MCP traffic,
// and prints tools/list + a validate_opf round-trip. Not shipped in npm package.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const child = spawn(process.execPath, ["dist/cli.js"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
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
  return new Promise((resolve) => {
    pending.set(id, resolve);
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

  const call = await request(
    "tools/call",
    { name: "validate_opf", arguments: { document: sample } },
    3,
  );
  const text = call.result?.content?.[0]?.text ?? JSON.stringify(call);
  console.log("validate_opf:", text.slice(0, 400));
} finally {
  child.stdin.end();
  await new Promise((r) => child.on("exit", r));
}
