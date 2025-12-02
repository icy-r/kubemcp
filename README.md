# Kube MCP

[![npm version](https://img.shields.io/npm/v/@icy-r/kube-mcp.svg)](https://www.npmjs.com/package/@icy-r/kube-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for Kubernetes cluster management. Enables AI assistants to interact with Kubernetes resources.

## Quick Start

```bash
npx @icy-r/kube-mcp
```

## MCP Configuration

Add to your MCP client (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "@icy-r/kube-mcp"],
      "env": {
        "KUBEMCP_DEFAULT_NAMESPACE": "default"
      }
    }
  }
}
```

**Custom kubeconfig:**

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "@icy-r/kube-mcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "custom",
        "KUBEMCP_KUBECONFIG_PATH": "/path/to/kubeconfig"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KUBEMCP_CONFIG_SOURCE` | `local` or `custom` | `local` |
| `KUBEMCP_KUBECONFIG_PATH` | Custom kubeconfig path | - |
| `KUBEMCP_DEFAULT_NAMESPACE` | Default namespace | `default` |
| `KUBEMCP_RESPONSE_FORMAT` | `json`, `toon`, `auto` | `auto` |

## Tools

| Tool | Actions |
|------|---------|
| `k8s_deployments` | list, get, scale, restart, get_status, get_metrics |
| `k8s_pods` | list, get, delete, get_logs, summarize_logs, get_status |
| `k8s_services` | list, get, get_endpoints |
| `k8s_configmaps` | list, get, create, update, delete |
| `k8s_secrets` | list, get, create, update, delete |
| `k8s_namespaces` | list, get, create, delete |
| `k8s_metrics` | get_pod_metrics, get_node_metrics |
| `k8s_events` | list, get_resource_events, get_recent_events |
| `k8s_audit` | get_config, configure, get_session_log, clear_session_log |

## Safety Features

Destructive actions require explicit confirmation:

```json
{ "action": "delete", "name": "my-pod", "confirm": true }
```

Preview changes with dry-run:

```json
{ "action": "scale", "name": "my-deployment", "replicas": 5, "dryRun": true }
```

## Development

```bash
git clone https://github.com/icy-r/kubemcp.git
cd kubemcp
pnpm install
pnpm build
pnpm test
```

## License

MIT
