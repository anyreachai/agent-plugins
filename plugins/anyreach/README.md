# Anyreach

Build AI agents that handle calls, web chats, and email — and automate everything around them.

Anyreach is a platform for building AI agents that handle real customer conversations across channels — phone calls, web voice and chat, and email — for sales, support, scheduling, and surveys. You configure an agent once and deploy it to any channel, run it outbound at scale with campaigns, ground it in your own knowledge, and automate the work around it with programmable workflows.

This plugin connects your AI coding agent to your Anyreach workspace through the hosted Anyreach MCP server at `https://api.anyreach.ai/mcp`. It ships no local code, hooks or scripts: the only thing it adds is that one remote MCP server.

## Try it

- "create a demo agent for <website url>"
- "create a workflow that syncs google sheet data into a custom data table"
- "analyze the conversations and give me a dashboard"

## Tools

The server exposes the same operations you have in the Anyreach dashboard — agents, conversations, knowledge bases, campaigns, telephony, workflows and your organization. Your assistant finds the right operation with `search_tools` and runs it through one of four call tools, split by what they can affect:

| Tool | Runs |
| - | - |
| `call_read_tool` | Reads only: lists, details, transcripts, metrics, searches and previews |
| `call_create_tool` | Adds something new without changing anything that exists |
| `call_change_tool` | Edits or deletes existing configuration or data |
| `call_live_tool` | Affects live traffic or reaches people: publishing, dialling, messaging, campaigns, workflows, phone numbers and routing |

Full overview: https://docs.anyreach.ai/mcp/overview

## Sign-in

You sign in with your Anyreach account on the Anyreach hosted sign-in page (OAuth 2.1 with PKCE). The assistant acts with exactly your permissions and never sees your password. No API key or client secret is stored in this plugin.

How each client registers with Anyreach's sign-in:

| Client | Config file | How it identifies itself |
| - | - | - |
| Claude Code | `.mcp.json` | Client ID Metadata Document (no client ID in the config) |
| Cursor | `mcp.json` | Pre-registered public client (`auth.CLIENT_ID`); callbacks `https://www.cursor.com/agents/mcp/oauth/callback` and `http://localhost:8787/callback` |
| Grok Build | `.grok-plugin/mcp.json` | Pre-registered public native client (`oauth.clientId`) requesting the server's scopes (`oauth.scopes`); loopback callback `http://127.0.0.1/callback` on a random port |
| Devin | `.devin-plugin/plugin.json` | Pre-registered public client (`oauthClientId`) requesting the server's scopes (`oauthScopes`), no client secret; callback `https://api.devin.ai/mcp/oauth/callback` |

Network endpoints this plugin talks to: `https://api.anyreach.ai/mcp` (the MCP server) and `https://auth.authenticately.com/oidc` (Anyreach's sign-in).

## Support

- Email: support@anyreach.ai
- Docs: https://docs.anyreach.ai/mcp/overview
- Privacy policy: https://anyreach.ai/legal/privacy
- Terms of service: https://anyreach.ai/legal/terms

## License

MIT — see [LICENSE](../../LICENSE).
