# KubeMCP - MicroK8s MCP Server for Cursor IDE

A production-ready Model Context Protocol (MCP) server for managing MicroK8s clusters directly from Cursor IDE. Built with TypeScript and designed for local development environments using Multipass VMs.

## Features

### 🚀 Comprehensive Kubernetes Management

- **Deployments**: List, get details, scale, restart, and monitor rollout status
- **Pods**: List, inspect, delete, retrieve logs, and check status
- **Services**: List, get details, and inspect endpoints
- **ConfigMaps & Secrets**: Full CRUD operations with secure handling
- **Namespaces**: List, create, delete, and inspect namespaces
- **Metrics**: Real-time CPU and memory usage for pods, nodes, and deployments
- **Events**: Monitor cluster events and troubleshoot issues

### ⚙️ Flexible Configuration

- **Dual Kubeconfig Mode**: 
  - Load from local `~/.kube/config`
  - Dynamically fetch from MicroK8s VM via Multipass
- **Environment-based Configuration**: Easy setup with environment variables
- **Default Namespace Support**: Set your preferred default namespace

### 🎯 Built for Quality

- Strict TypeScript with full type safety
- Comprehensive error handling
- ESLint + Prettier for code quality
- Jest for testing
- Husky pre-commit hooks

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Multipass (if using VM mode)
- MicroK8s cluster (running in Multipass VM or locally)
- kubectl configured (for local mode)

### Quick Install (Recommended)

Install globally via npm:

```bash
npm install -g kubemcp
```

Or use directly with npx (no installation needed):

```bash
npx kubemcp
```

### Development Setup

1. **Clone and install dependencies:**

```bash
cd D:\Github\kubeMcp
npm install
```

2. **Build the project:**

```bash
npm run build
```

3. **Configure environment (optional):**

Create a `.env` file in the project root:

```env
# Kubeconfig source: 'local' or 'multipass'
KUBEMCP_CONFIG_SOURCE=local

# VM name for multipass mode (default: microk8s-vm)
KUBEMCP_VM_NAME=microk8s-vm

# Default namespace (default: default)
KUBEMCP_DEFAULT_NAMESPACE=default

# Log level: 'error' | 'warn' | 'info' | 'debug'
KUBEMCP_LOG_LEVEL=info

# Response format: 'json' | 'toon' | 'auto' (default: auto)
KUBEMCP_RESPONSE_FORMAT=auto

# Log filtering defaults
KUBEMCP_LOG_MAX_LINES=100          # Max lines per log request
KUBEMCP_LOG_MAX_BYTES=102400       # Max bytes (100KB default)
KUBEMCP_LOG_DEFAULT_SEVERITY=WARN  # Filter low-priority logs
```

## Token Optimization

KubeMCP includes advanced features to dramatically reduce token consumption when working with LLMs:

### 🎒 TOON Format Support

Automatically uses [TOON (Token-Oriented Object Notation)](https://github.com/johannschopplich/toon) for responses that benefit from it:

- **50-60% token reduction** for list operations (pods, deployments, services, etc.)
- **Automatic format selection** - uses TOON for uniform arrays, JSON for complex structures
- **Tab-delimited encoding** for maximum compression

**Example:**

```bash
# JSON format (traditional)
[
  {
    "name": "nginx-7d5f8c9d4b-abc12",
    "status": "Running",
    "cpu": "50m"
  },
  {
    "name": "nginx-7d5f8c9d4b-def34",
    "status": "Running",
    "cpu": "45m"
  }
]
# Tokens: ~80

# TOON format (automatic)
[2	]{name	status	cpu}:
  nginx-7d5f8c9d4b-abc12	Running	50m
  nginx-7d5f8c9d4b-def34	Running	45m
# Tokens: ~30 (62% reduction)
```

**Configuration:**

```env
# auto: Smart selection (recommended)
# toon: Always use TOON
# json: Always use JSON
KUBEMCP_RESPONSE_FORMAT=auto
```

### 📊 Advanced Log Filtering

Reduce log volumes by 80-95% with powerful filtering options:

#### 1. **Severity Filtering**

Only fetch logs at or above a specific level:

```typescript
k8s_get_pod_logs({
  name: "my-pod",
  severityFilter: "ERROR"  // Only ERROR logs
})
```

Levels: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE`

#### 2. **Time-Based Filtering**

```typescript
k8s_get_pod_logs({
  name: "my-pod",
  sinceSeconds: 3600  // Last hour only
})

// Or specific timestamp
k8s_get_pod_logs({
  name: "my-pod",
  sinceTime: "2025-01-01T10:00:00Z"
})
```

#### 3. **Grep Filtering**

Regex pattern matching:

```typescript
k8s_get_pod_logs({
  name: "my-pod",
  grep: "error|timeout|failed"  // Only matching lines
})
```

#### 4. **Size Limits**

Automatic truncation to prevent token overflow:

```typescript
k8s_get_pod_logs({
  name: "my-pod",
  maxBytes: 50000,  // 50KB max
  tail: 100         // Last 100 lines
})
```

### 📈 Log Summarization

Get insights without fetching full logs - **90%+ token reduction**:

```typescript
k8s_summarize_pod_logs({
  name: "my-pod",
  tail: 1000
})
```

**Returns:**

```json
{
  "totalLines": 1000,
  "estimatedBytes": 245678,
  "timeRange": {
    "earliest": "2025-01-01T10:00:00Z",
    "latest": "2025-01-01T11:00:00Z"
  },
  "severityCounts": {
    "ERROR": 12,
    "WARN": 45,
    "INFO": 890,
    "DEBUG": 53,
    "TRACE": 0
  },
  "topErrors": [
    {
      "pattern": "Database connection timeout",
      "count": 8,
      "sample": "2025-01-01T10:30:15Z ERROR Database connection timeout after 30s"
    }
  ],
  "recentErrors": [
    "2025-01-01T10:59:55Z ERROR Failed to process request"
  ]
}
```

**Use case:** Quickly diagnose issues without consuming thousands of tokens on full logs.

### 🎯 Best Practices

1. **Start with summaries**: Use `k8s_summarize_pod_logs` to understand what's happening
2. **Filter aggressively**: Use `severityFilter: "ERROR"` for production debugging
3. **Limit time range**: Use `sinceSeconds` to focus on recent activity
4. **Let auto-format work**: Keep `KUBEMCP_RESPONSE_FORMAT=auto` for optimal compression
5. **Set defaults**: Configure `KUBEMCP_LOG_DEFAULT_SEVERITY=WARN` to filter noise by default

### Token Savings Examples

| Operation | Traditional (JSON) | Optimized (TOON + Filters) | Reduction |
|-----------|-------------------|---------------------------|-----------|
| List 50 pods | ~2,500 tokens | ~1,000 tokens | 60% |
| Pod logs (10K lines) | ~40,000 tokens | ~2,000 tokens (filtered) | 95% |
| Log summary | ~40,000 tokens | ~400 tokens | 99% |
| List deployments (20) | ~1,800 tokens | ~700 tokens | 61% |



## Configuration

### Local Mode (Default)

Uses the standard kubeconfig file at `~/.kube/config`:

```env
KUBEMCP_CONFIG_SOURCE=local
```

### Multipass Mode

Dynamically fetches kubeconfig from your MicroK8s VM:

```env
KUBEMCP_CONFIG_SOURCE=multipass
KUBEMCP_VM_NAME=microk8s-vm
```

This mode executes `multipass exec <vm> -- sudo microk8s config` to get the kubeconfig.

## Integration with Cursor IDE

Add the MCP server to your Cursor settings. Open Cursor Settings → Features → MCP and add the server configuration:

### Option 1: Using npx (Recommended - No Installation Required)

```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "npx",
      "args": ["-y", "kubemcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "local",
        "KUBEMCP_DEFAULT_NAMESPACE": "default",
        "KUBEMCP_RESPONSE_FORMAT": "auto",
        "KUBEMCP_LOG_MAX_LINES": "100",
        "KUBEMCP_LOG_DEFAULT_SEVERITY": "WARN"
      }
    }
  }
}
```

### Option 2: Using Global Installation

First install globally:
```bash
npm install -g kubemcp
```

Then configure:
```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "kubemcp",
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "local",
        "KUBEMCP_DEFAULT_NAMESPACE": "default",
        "KUBEMCP_RESPONSE_FORMAT": "auto",
        "KUBEMCP_LOG_MAX_LINES": "100",
        "KUBEMCP_LOG_DEFAULT_SEVERITY": "WARN"
      }
    }
  }
}
```

### Option 3: Using Local Development Build

```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "node",
      "args": ["/path/to/kubeMcp/dist/index.js"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "local",
        "KUBEMCP_DEFAULT_NAMESPACE": "default",
        "KUBEMCP_RESPONSE_FORMAT": "auto",
        "KUBEMCP_LOG_MAX_LINES": "100",
        "KUBEMCP_LOG_DEFAULT_SEVERITY": "WARN"
      }
    }
  }
}
```

### Multipass Mode Configuration

For any of the above options, use Multipass mode by changing the environment variables:

```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "npx",
      "args": ["-y", "kubemcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "multipass",
        "KUBEMCP_VM_NAME": "microk8s-vm",
        "KUBEMCP_DEFAULT_NAMESPACE": "default",
        "KUBEMCP_RESPONSE_FORMAT": "auto"
      }
    }
  }
}
```

## Available Tools

### Deployment Management

#### `k8s_list_deployments`
List all deployments in a namespace.

**Parameters:**
- `namespace` (optional): Target namespace

**Example:**
```typescript
k8s_list_deployments({ namespace: "default" })
```

#### `k8s_get_deployment`
Get detailed information about a specific deployment.

**Parameters:**
- `name` (required): Deployment name
- `namespace` (optional): Target namespace

#### `k8s_scale_deployment`
Scale a deployment to a specified number of replicas.

**Parameters:**
- `name` (required): Deployment name
- `replicas` (required): Desired replica count
- `namespace` (optional): Target namespace

#### `k8s_restart_deployment`
Perform a rolling restart of a deployment.

**Parameters:**
- `name` (required): Deployment name
- `namespace` (optional): Target namespace

#### `k8s_get_deployment_status`
Get the rollout status of a deployment.

**Parameters:**
- `name` (required): Deployment name
- `namespace` (optional): Target namespace

### Pod Management

#### `k8s_list_pods`
List all pods with optional label filtering.

**Parameters:**
- `namespace` (optional): Target namespace
- `labelSelector` (optional): Label selector (e.g., "app=nginx")

#### `k8s_get_pod`
Get detailed information about a specific pod.

**Parameters:**
- `name` (required): Pod name
- `namespace` (optional): Target namespace

#### `k8s_delete_pod`
Delete a pod (useful for forcing a restart).

**Parameters:**
- `name` (required): Pod name
- `namespace` (optional): Target namespace

#### `k8s_get_pod_logs`
Retrieve logs from a pod.

**Parameters:**
- `name` (required): Pod name
- `namespace` (optional): Target namespace
- `container` (optional): Container name
- `tail` (optional): Number of lines to tail
- `previous` (optional): Get logs from previous container instance

#### `k8s_get_pod_status`
Get detailed status information for a pod.

**Parameters:**
- `name` (required): Pod name
- `namespace` (optional): Target namespace

### Service Management

#### `k8s_list_services`
List all services in a namespace.

#### `k8s_get_service`
Get details of a specific service.

#### `k8s_get_service_endpoints`
Get endpoints for a service.

### ConfigMap Management

#### `k8s_list_configmaps`
List all ConfigMaps in a namespace.

#### `k8s_get_configmap`
Get a specific ConfigMap.

#### `k8s_create_configmap`
Create a new ConfigMap.

**Parameters:**
- `name` (required): ConfigMap name
- `data` (required): Key-value pairs
- `namespace` (optional): Target namespace

#### `k8s_update_configmap`
Update an existing ConfigMap.

#### `k8s_delete_configmap`
Delete a ConfigMap.

### Secret Management

#### `k8s_list_secrets`
List all Secrets in a namespace.

#### `k8s_get_secret`
Get metadata for a Secret (data is not exposed).

#### `k8s_create_secret`
Create a new Secret.

**Parameters:**
- `name` (required): Secret name
- `data` (required): Key-value pairs (will be base64 encoded)
- `type` (optional): Secret type (default: "Opaque")
- `namespace` (optional): Target namespace

#### `k8s_update_secret`
Update an existing Secret.

#### `k8s_delete_secret`
Delete a Secret.

### Namespace Management

#### `k8s_list_namespaces`
List all namespaces in the cluster.

#### `k8s_get_namespace`
Get details of a specific namespace.

#### `k8s_create_namespace`
Create a new namespace.

#### `k8s_delete_namespace`
Delete a namespace.

### Metrics

#### `k8s_get_pod_metrics`
Get CPU and memory usage for pods.

**Parameters:**
- `namespace` (optional): Target namespace
- `podName` (optional): Specific pod name

#### `k8s_get_node_metrics`
Get resource usage for cluster nodes.

**Parameters:**
- `nodeName` (optional): Specific node name

#### `k8s_get_deployment_metrics`
Get aggregated metrics for all pods in a deployment.

**Parameters:**
- `name` (required): Deployment name
- `namespace` (optional): Target namespace

### Events

#### `k8s_get_events`
Get cluster events with optional filtering.

**Parameters:**
- `namespace` (optional): Target namespace
- `fieldSelector` (optional): Field selector for filtering
- `limit` (optional): Maximum number of events

#### `k8s_get_resource_events`
Get events for a specific resource.

**Parameters:**
- `kind` (required): Resource kind (e.g., "Pod", "Deployment")
- `name` (required): Resource name
- `namespace` (optional): Target namespace

#### `k8s_get_recent_events`
Get recent events sorted by timestamp.

**Parameters:**
- `namespace` (optional): Target namespace
- `limit` (optional): Maximum number of events (default: 50)

## Development

### Scripts

```bash
# Development with auto-reload
npm run dev

# Build
npm run build

# Run built server
npm start

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Type checking
npm run typecheck

# Testing
npm test
npm run test:watch
npm run test:coverage
```

### Project Structure

```
kubeMcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── config/
│   │   ├── kubeconfig.ts     # Kubeconfig loader
│   │   └── settings.ts       # Server configuration
│   ├── tools/
│   │   ├── deployments.ts    # Deployment tools
│   │   ├── pods.ts           # Pod tools
│   │   ├── services.ts       # Service tools
│   │   ├── configmaps.ts     # ConfigMap tools
│   │   ├── secrets.ts        # Secret tools
│   │   ├── namespaces.ts     # Namespace tools
│   │   ├── metrics.ts        # Metrics tools
│   │   └── events.ts         # Event tools
│   ├── utils/
│   │   ├── k8s-client.ts     # Kubernetes client wrapper
│   │   └── multipass.ts      # Multipass utilities
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── tests/                    # Test files
├── dist/                     # Compiled output
└── package.json
```

## Testing

Run the test suite:

```bash
npm test
```

With coverage:

```bash
npm run test:coverage
```

## Troubleshooting

### Cannot connect to cluster

**Error:** `Failed to load kubeconfig`

**Solutions:**
- **Local mode**: Ensure `~/.kube/config` exists and is valid
- **Multipass mode**: 
  - Verify VM is running: `multipass list`
  - Check VM name matches `KUBEMCP_VM_NAME`
  - Ensure MicroK8s is running in the VM

### Metrics not available

**Error:** `Failed to get pod metrics`

**Solution:** Ensure metrics-server is enabled in MicroK8s:

```bash
multipass exec <vm-name> -- sudo microk8s enable metrics-server
```

### Permission denied

**Error:** `Forbidden: User cannot list resource`

**Solution:** Check your kubeconfig has proper permissions for the cluster.

## Integration with Development Environments

This MCP server works seamlessly with various Kubernetes development environments:

- Works with existing Multipass setup
- Can read VM IP from configuration files if needed
- Supports standard Kubernetes operations

## Contributing

1. Follow the existing code style (enforced by ESLint/Prettier)
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass: `npm test`
5. Check linting: `npm run lint`

## License

MIT

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review Cursor IDE MCP documentation
3. Check Kubernetes/MicroK8s documentation

---

**Built with ❤️ for Cursor IDE and MicroK8s**

