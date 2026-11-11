#!/usr/bin/env node
// Generates every marketplace catalog, plugin manifest, MCP config and
// server.json from the metadata in shared/. Edit shared/, never the outputs.
//
//   node scripts/sync.mjs           write the generated files
//   node scripts/sync.mjs --check   fail if any generated file is stale (CI)
//   node scripts/sync.mjs --strict  also fail on *_TBD placeholders (release)
//   node scripts/sync.mjs --verify-scopes
//                                   compare mcp.oauthScopes with the scopes each
//                                   server advertises in its 401 (needs network)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const CHECK = args.has("--check") || args.has("--strict") || args.has("--verify-scopes");
const STRICT = args.has("--strict");
const VERIFY_SCOPES = args.has("--verify-scopes");

const REGISTRY_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
const CLAUDE_MANIFEST_SCHEMA =
  "https://json.schemastore.org/claude-code-plugin-manifest.json";
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const render = (value) => JSON.stringify(value, null, 2) + "\n";

const market = readJson("shared/marketplace.json");
const plugins = market.plugins.map((name) => readJson(`shared/plugins/${name}.json`));

const errors = [];
const warnings = [];

function lint(p) {
  const where = `shared/plugins/${p.name}.json`;
  const fail = (msg) => errors.push(`${where}: ${msg}`);
  if (!KEBAB.test(p.name)) fail("name must be kebab-case");
  if (!p.mcp?.url?.startsWith("https://")) fail("mcp.url must be https");
  if (p.registry && p.registry.description.length > 100)
    fail(`registry.description is ${p.registry.description.length} chars (max 100)`);
  // Grok's CTA fires on keywords, so every keyword must name the product.
  for (const k of p.keywords)
    if (!k.toLowerCase().includes(p.name)) fail(`keyword "${k}" is not brand-scoped`);
  const devin = p.clients.devin;
  if (devin) {
    const d = devin.description;
    if (d.length < 60 || d.length > 130) fail(`devin.description is ${d.length} chars (60-130)`);
    if (d.endsWith(".")) fail("devin.description must not end with a period");
    if (devin.shortDescription.length > 40) fail("devin.shortDescription exceeds 40 chars");
  }
  if (!existsSync(join(ROOT, "plugins", p.name, p.logo))) fail(`logo ${p.logo} is missing`);
  if (!Array.isArray(p.mcp.oauthScopes) || !p.mcp.oauthScopes.length)
    fail("mcp.oauthScopes must list the scopes the server advertises");
  for (const [client, cfg] of Object.entries(p.clients))
    if (cfg.oauthClientId?.endsWith("_TBD"))
      (STRICT ? errors : warnings).push(`${where}: ${client} OAuth client ID is a placeholder`);
}

const author = { name: market.owner.name, email: market.owner.email, url: market.owner.url };
const common = (p) => ({
  name: p.name,
  displayName: p.displayName,
  version: p.version,
  description: p.description,
  author,
  homepage: p.homepage,
  repository: market.repository,
  license: market.license,
  keywords: p.keywords,
});
const httpServer = (p, extra = {}) => ({
  mcpServers: { [p.mcp.server]: { type: "http", url: p.mcp.url, ...extra } },
});

function pluginFiles(p) {
  const dir = `plugins/${p.name}`;
  const { cursor, claude, grok, devin } = p.clients;
  const files = {};

  // Cursor reads mcp.json; static OAuth goes in `auth` (cursor.com/docs/mcp "Static OAuth").
  if (cursor) {
    files[`${dir}/.cursor-plugin/plugin.json`] = {
      ...common(p),
      logo: p.logo,
      mcpServers: "./mcp.json",
    };
    const auth = cursor.oauthClientId ? { auth: { CLIENT_ID: cursor.oauthClientId } } : {};
    files[`${dir}/mcp.json`] = {
      mcpServers: { [p.mcp.server]: { url: p.mcp.url, ...auth } },
    };
  }

  // Claude registers itself through a Client ID Metadata Document, so URL only.
  if (claude) {
    files[`${dir}/.claude-plugin/plugin.json`] = {
      $schema: CLAUDE_MANIFEST_SCHEMA,
      ...common(p),
      mcpServers: "./.mcp.json",
    };
    files[`${dir}/.mcp.json`] = httpServer(p);
  }

  // Grok and Claude both default to the root .mcp.json, so Grok gets its own
  // file: Grok's client ID must not leak into Claude. Never pin callbackPort:
  // Grok binds a random loopback port.
  if (grok) {
    files[`${dir}/.grok-plugin/plugin.json`] = {
      ...common(p),
      logo: `./${p.logo}`,
      mcpServers: "./.grok-plugin/mcp.json",
    };
    // Grok sends no `scope` unless told, and Logto then grants nothing for the
    // MCP resource (access_denied), so the scopes are listed explicitly.
    const oauth = grok.oauthClientId
      ? { oauth: { clientId: grok.oauthClientId, scopes: p.mcp.oauthScopes } }
      : {};
    files[`${dir}/.grok-plugin/mcp.json`] = httpServer(p, oauth);
  }

  // Devin servers go inline in its manifest (CognitionAI/devin-marketplace);
  // oauthScopes needs oauthClientId, and a plugin may not declare a secret
  // (docs.devin.ai/product-guides/plugin-mcp-setups).
  if (devin) {
    const server = { url: p.mcp.url };
    if (devin.oauthClientId) {
      server.oauthClientId = devin.oauthClientId;
      server.oauthScopes = p.mcp.oauthScopes;
    }
    files[`${dir}/.devin-plugin/plugin.json`] = {
      name: p.name,
      displayName: p.displayName,
      description: devin.description,
      shortDescription: devin.shortDescription,
      homepage: p.homepage,
      repository: market.repository,
      logo: p.logo,
      keywords: devin.keywords,
      mcpServers: { [p.mcp.server]: server },
    };
  }

  if (p.registry) {
    files[p.registry.path] = {
      $schema: REGISTRY_SCHEMA,
      name: p.registry.name,
      title: p.registry.title,
      description: p.registry.description,
      version: p.version,
      websiteUrl: p.homepage,
      remotes: [{ type: "streamable-http", url: p.mcp.url }],
    };
  }
  return files;
}

function catalogFiles() {
  const listed = (client) => plugins.filter((p) => p.clients[client]);
  const owner = { name: market.owner.name, email: market.owner.email };
  return {
    ".cursor-plugin/marketplace.json": {
      name: market.name,
      owner,
      metadata: { description: market.description },
      plugins: listed("cursor").map((p) => ({
        name: p.name,
        source: `./plugins/${p.name}`,
        description: p.summary,
      })),
    },
    ".claude-plugin/marketplace.json": {
      name: market.name,
      owner,
      metadata: { description: market.description },
      plugins: listed("claude").map((p) => ({
        name: p.name,
        source: `./plugins/${p.name}`,
        description: p.summary,
        version: p.version,
        author: owner,
        homepage: p.homepage,
        keywords: p.keywords,
      })),
    },
    ".grok-plugin/marketplace.json": {
      name: market.name,
      description: market.description,
      owner,
      plugins: listed("grok").map((p) => ({
        name: p.name,
        description: p.summary,
        category: p.clients.grok.category,
        source: { type: "local", path: `./plugins/${p.name}` },
        version: p.version,
        homepage: p.homepage,
        keywords: p.keywords,
        domains: p.clients.grok.domains,
      })),
    },
  };
}

// The server lists its scopes in the WWW-Authenticate header of an
// unauthenticated request; mcp.oauthScopes has to match it exactly.
async function verifyScopes(p) {
  const res = await fetch(p.mcp.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sync", version: "0" } },
    }),
  });
  const advertised = /scope="([^"]*)"/.exec(res.headers.get("www-authenticate") ?? "")?.[1];
  if (advertised === undefined) {
    errors.push(`${p.mcp.url}: no scope in WWW-Authenticate (HTTP ${res.status})`);
    return;
  }
  const want = advertised.split(" ").filter(Boolean);
  const have = p.mcp.oauthScopes;
  const missing = want.filter((s) => !have.includes(s));
  const extra = have.filter((s) => !want.includes(s));
  if (missing.length || extra.length)
    errors.push(
      `shared/plugins/${p.name}.json: mcp.oauthScopes differs from ${p.mcp.url}` +
        (missing.length ? `; missing ${missing.join(" ")}` : "") +
        (extra.length ? `; not advertised ${extra.join(" ")}` : ""),
    );
  else console.log(`ok: ${p.name} scopes match ${p.mcp.url} (${want.length})`);
}

plugins.forEach(lint);
if (VERIFY_SCOPES) for (const p of plugins) await verifyScopes(p);
const outputs = Object.assign(catalogFiles(), ...plugins.map(pluginFiles));

const stale = [];
for (const [rel, value] of Object.entries(outputs)) {
  const path = join(ROOT, rel);
  const want = render(value);
  const have = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (have === want) continue;
  if (CHECK) {
    stale.push(rel);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, want);
    console.log(`wrote ${relative(ROOT, path)}`);
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const rel of stale) errors.push(`${rel} is out of date; run node scripts/sync.mjs`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log(`ok: ${Object.keys(outputs).length} generated files ${CHECK ? "up to date" : "in sync"}`);
