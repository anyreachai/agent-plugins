# Security policy

## Reporting a vulnerability

Email **support@anyreach.ai** with the subject "Security" and a description of the issue, the affected plugin or endpoint, and steps to reproduce. Please do not open a public GitHub issue for security reports.

We acknowledge reports within two business days and keep you updated until the issue is resolved.

## What these plugins contain

The plugins in this repository contain configuration only: plugin manifests, MCP server definitions and documentation. They ship no executable code, hooks or install scripts. Each plugin adds one remote MCP server hosted by Anyreach:

| Plugin | Endpoint |
| - | - |
| `anyreach` | `https://api.anyreach.ai/mcp` |

Sign-in uses OAuth 2.1 with PKCE against `https://auth.authenticately.com/oidc`. The OAuth client IDs in this repository identify public clients; they are not secrets, and no client secret, API key or token is stored here.

## Scope

In scope: the manifests in this repository and the MCP endpoints they reference. Issues in a client application (Claude Code, Cursor, Grok Build, Devin) should be reported to that vendor.
