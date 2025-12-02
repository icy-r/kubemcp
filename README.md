# Kube MCP

[![CI](https://github.com/icy-r/kube-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/icy-r/kube-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@icy-r/kube-mcp.svg)](https://www.npmjs.com/package/@icy-r/kube-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for Kubernetes cluster management. This server enables AI assistants to interact with Kubernetes resources through a standardized MCP interface.

## Features

- **9 Consolidated Tools** - Comprehensive Kubernetes management with minimal tool count
- **Safety Features** - Audit logging, dry-run mode, confirmation safeguards for destructive operations
- **Token Efficient** - TOON format support for optimized LLM responses
- **Log Intelligence** - Severity filtering, grep patterns, log summarization
- **Flexible Config** - Local kubeconfig or custom path support

## Installation

```bash
npm install @icy-r/kube-mcp
```

Or run directly with npx:

```bash
npx @icy-r/kube-mcp
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KUBEMCP_CONFIG_SOURCE` | Config source: `local` or `custom` | `local` |
| `KUBEMCP_KUBECONFIG_PATH` | Custom kubeconfig path | - |
| `KUBEMCP_DEFAULT_NAMESPACE` | Default namespace | `default` |
| `KUBEMCP_LOG_LEVEL` | Log level: `error`, `warn`, `info`, `debug` | `info` |
| `KUBEMCP_RESPONSE_FORMAT` | Response format: `json`, `toon`, `auto` | `auto` |
| `KUBEMCP_LOG_MAX_LINES` | Max log lines to return | `100` |
| `KUBEMCP_LOG_MAX_BYTES` | Max log bytes to return | `102400` |
| `KUBEMCP_LOG_DEFAULT_SEVERITY` | Default log severity filter | - |

### MCP Configuration

Add to your MCP client configuration (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["@icy-r/kube-mcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "local",
        "KUBEMCP_DEFAULT_NAMESPACE": "default"
      }
    }
  }
}
```

## Tools

### k8s_deployments

Manage Kubernetes deployments.

**Actions:**
- `list` - List all deployments in a namespace
- `get` - Get deployment details
- `scale` - Scale deployment replicas (requires confirm=true or dryRun=true)
- `restart` - Perform rolling restart (requires confirm=true or dryRun=true)
- `get_status` - Get rollout status
- `get_metrics` - Get aggregated metrics for a deployment

### k8s_pods

Manage Kubernetes pods.

**Actions:**
- `list` - List pods with optional label selector
- `get` - Get pod details
- `delete` - Delete a pod (requires confirm=true or dryRun=true)
- `get_logs` - Get logs with filtering (severity, grep, time-based)
- `get_status` - Get detailed pod status
- `summarize_logs` - Get log summary statistics (90%+ token reduction)

### k8s_services

Manage Kubernetes services.

**Actions:**
- `list` - List all services in a namespace
- `get` - Get service details
- `get_endpoints` - Get endpoints for a service

### k8s_configmaps

Manage Kubernetes ConfigMaps.

**Actions:**
- `list` - List all ConfigMaps
- `get` - Get a specific ConfigMap
- `create` - Create a new ConfigMap
- `update` - Update an existing ConfigMap (requires confirm=true or dryRun=true)
- `delete` - Delete a ConfigMap (requires confirm=true or dryRun=true)

### k8s_secrets

Manage Kubernetes Secrets.

**Actions:**
- `list` - List all Secrets
- `get` - Get a specific Secret (metadata only, no data)
- `create` - Create a new Secret
- `update` - Update an existing Secret (requires confirm=true or dryRun=true)
- `delete` - Delete a Secret (requires confirm=true or dryRun=true)

### k8s_namespaces

Manage Kubernetes namespaces.

**Actions:**
- `list` - List all namespaces
- `get` - Get namespace details
- `create` - Create a new namespace
- `delete` - Delete a namespace (requires confirm=true or dryRun=true)

### k8s_metrics

Get Kubernetes resource metrics.

**Actions:**
- `get_pod_metrics` - Get CPU/Memory metrics for pods
- `get_node_metrics` - Get CPU/Memory metrics for nodes

### k8s_events

Get Kubernetes cluster events.

**Actions:**
- `list` - Get cluster events with optional filtering
- `get_resource` - Get events for a specific resource
- `get_recent` - Get recent events sorted by timestamp

### k8s_audit

Manage audit logging and safety controls.

**Actions:**
- `get_status` - Check dry-run mode and session stats
- `set_dry_run` - Enable/disable dry-run mode globally
- `get_session_log` - View changes made in this session
- `get_stats` - Get statistics about operations in this session
- `clear_session` - Clear session audit log
- `configure` - Update audit settings

## Safety Features

### Dry-Run Mode

Preview changes without executing:

```json
{
  "action": "scale",
  "name": "my-deployment",
  "replicas": 5,
  "dryRun": true
}
```

### Confirmation Required

Destructive actions require explicit confirmation:

```json
{
  "action": "delete",
  "name": "my-pod",
  "confirm": true
}
```

### Audit Logging

All operations are logged for the session:

```json
{
  "action": "get_session_log"
}
```

## Development

### Setup

```bash
git clone https://github.com/icy-r/kube-mcp.git
cd kube-mcp
pnpm install
```

### Commands

```bash
# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck

# Development mode
pnpm dev
```

## License

MIT
