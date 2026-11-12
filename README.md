# Anyreach agent plugins

Official plugins that connect AI coding agents — Claude Code, Cursor, Grok Build and Devin — to [Anyreach](https://anyreach.ai) over MCP.

| Plugin | What it does | MCP server |
| - | - | - |
| [`anyreach`](plugins/anyreach) | Build AI agents that handle calls, web chats, and email — and automate everything around them | `https://api.anyreach.ai/mcp` |

## Install

**Claude Code**

```text
/plugin marketplace add anyreachai/agent-plugins
/plugin install anyreach@anyreach
```

**Cursor** — install **Anyreach** from the [Cursor Marketplace](https://cursor.com/marketplace).

**Grok Build**

```bash
grok plugin marketplace add anyreachai/agent-plugins
grok plugin install anyreach --trust
```

**Devin** — enable **Anyreach** under **Customize → Plugins**.

Any other MCP client: add the remote server `https://api.anyreach.ai/mcp` and sign in with your Anyreach account. See https://docs.anyreach.ai/mcp/overview.

## Repository layout

```
.claude-plugin/marketplace.json   Claude Code catalog
.cursor-plugin/marketplace.json   Cursor catalog
.grok-plugin/marketplace.json     Grok Build catalog
server.json                       Official MCP Registry entry (ai.anyreach/anyreach)
plugins/<product>/
  .claude-plugin/plugin.json  + .mcp.json               Claude Code
  .cursor-plugin/plugin.json  + mcp.json                Cursor
  .grok-plugin/plugin.json    + .grok-plugin/mcp.json   Grok Build
  .devin-plugin/plugin.json   (servers inline)          Devin
  assets/logo.svg, README.md, skills/
shared/                           Source of truth for every file above
scripts/sync.mjs                  Generator
```

Each client gets its own MCP config because their OAuth setups differ: Claude registers itself with a Client ID Metadata Document, while Cursor, Grok Build and Devin use pre-registered public clients with different redirect URIs. Grok and Claude would otherwise both read the root `.mcp.json`, so the Grok manifest points at `.grok-plugin/mcp.json` instead.

## Editing

Every catalog, manifest, MCP config and `server.json` is generated. Edit `shared/`, then:

```bash
node scripts/sync.mjs           # regenerate
node scripts/sync.mjs --check   # what CI runs
node scripts/sync.mjs --strict  # also fails on *_TBD placeholders; run before a release
node scripts/sync.mjs --verify-scopes  # compares mcp.oauthScopes with the live server
```

`mcp.oauthScopes` in `shared/plugins/anyreach.json` must match the scopes `https://api.anyreach.ai/mcp` advertises in the `scope="…"` of its 401 `WWW-Authenticate` header. Grok Build and Devin send only the scopes listed in their config (`oauth.scopes` and `oauthScopes`, both generated from this list). Without them, Anyreach's sign-in grants nothing for the MCP resource and returns `access_denied`. Whenever the server's scopes change, update the list and run `--verify-scopes`.

## Publishing to the MCP Registry

`.github/workflows/publish-mcp-registry.yml` publishes `server.json` to the [Official MCP Registry](https://registry.modelcontextprotocol.io) as `ai.anyreach/anyreach`. It runs when `server.json` changes on `main`, or by hand from the Actions tab, and skips a version the registry already has. To publish a change, bump `version` in `shared/`.

The registry checks that we control anyreach.ai through an `MCPv1` TXT record on the anyreach.ai apex. The matching Ed25519 private key is the `MCP_PRIVATE_KEY` secret on the `mcp-registry-publish` environment, which only `main` can use. To rotate the key, publish the new TXT record, update the secret, then remove the old record.

## Support

support@anyreach.ai · [Security policy](SECURITY.md) · [Privacy](https://anyreach.ai/legal/privacy) · [Terms](https://anyreach.ai/legal/terms)

## License

[MIT](LICENSE)
