# KubeMCP - Kubernetes MCP Server for Cursor/VSCode IDE

A Model Context Protocol (MCP) server for managing Kubernetes clusters directly from Cursor IDE. Manage deployments, pods, services, logs, metrics, and more through AI-powered conversations.

## Features

- **Full K8s Management**: Deployments, Pods, Services, ConfigMaps, Secrets, Namespaces
- **Advanced Logging**: Severity filtering, time-based queries, log summarization
- **Real-time Metrics**: CPU/memory usage for pods, nodes, and deployments
- **Event Monitoring**: Track cluster events and troubleshoot issues
- **Token Optimization**: TOON format support for 50-60% token reduction
- **Flexible Config**: Local kubeconfig or dynamic Multipass VM support

## Quick Start

### Installation

```bash
# Use with npx (no installation)
npx kubemcp

# Or install globally
npm install -g kubemcp
```

### Cursor IDE Setup

Add to your Cursor MCP settings (Settings → Features → MCP):

**Using npx (recommended):**
```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "npx",
      "args": ["-y", "kubemcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "local"
      }
    }
  }
}
```

**Using global install:**
```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "kubemcp",
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "local"
      }
    }
  }
}
```

**For Multipass/VM mode:**
```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "npx",
      "args": ["-y", "kubemcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "multipass",
        "KUBEMCP_VM_NAME": "microk8s-vm"
      }
    }
  }
}
```

**For Custom Kubeconfig Path (Network/Remote):**
```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "npx",
      "args": ["-y", "kubemcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "custom",
        "KUBEMCP_KUBECONFIG_PATH": "/path/to/custom/kubeconfig"
      }
    }
  }
}
```

**Windows Network Path Example:**
```json
{
  "mcpServers": {
    "kubemcp": {
      "command": "npx",
      "args": ["-y", "kubemcp"],
      "env": {
        "KUBEMCP_CONFIG_SOURCE": "custom",
        "KUBEMCP_KUBECONFIG_PATH": "\\\\server\\share\\kubeconfig"
      }
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KUBEMCP_CONFIG_SOURCE` | `local` | Kubeconfig source: `local`, `multipass`, or `custom` |
| `KUBEMCP_KUBECONFIG_PATH` | - | Custom kubeconfig path (required if `configSource=custom`) |
| `KUBEMCP_VM_NAME` | `microk8s-vm` | VM name for multipass mode |
| `KUBEMCP_DEFAULT_NAMESPACE` | `default` | Default namespace |
| `KUBEMCP_RESPONSE_FORMAT` | `auto` | Response format: `auto`, `json`, or `toon` |
| `KUBEMCP_LOG_MAX_LINES` | `100` | Max log lines per request |
| `KUBEMCP_LOG_DEFAULT_SEVERITY` | `INFO` | Default log severity filter |

### Kubeconfig Modes

**Local Mode:** Uses `~/.kube/config`
```env
KUBEMCP_CONFIG_SOURCE=local
```

**Multipass Mode:** Fetches from MicroK8s VM dynamically
```env
KUBEMCP_CONFIG_SOURCE=multipass
KUBEMCP_VM_NAME=microk8s-vm
```

**Custom Path Mode:** Use custom kubeconfig from any location (network, remote, etc.)
```env
KUBEMCP_CONFIG_SOURCE=custom
KUBEMCP_KUBECONFIG_PATH=/path/to/kubeconfig
```

**Examples of Custom Paths:**
- Linux/Mac: `/mnt/network-share/kubeconfig`
- Windows UNC: `\\server\share\kubeconfig`
- Windows Mapped Drive: `Z:\configs\kubeconfig`
- Remote config: `/remote/cluster/config`

## Available Tools

### Deployments
- `k8s_list_deployments` - List all deployments
- `k8s_get_deployment` - Get deployment details
- `k8s_scale_deployment` - Scale deployment replicas
- `k8s_restart_deployment` - Rolling restart
- `k8s_get_deployment_status` - Check rollout status

### Pods
- `k8s_list_pods` - List pods (supports label selectors)
- `k8s_get_pod` - Get pod details
- `k8s_delete_pod` - Delete pod
- `k8s_get_pod_logs` - Get logs with filtering
- `k8s_get_pod_status` - Get pod status
- `k8s_summarize_pod_logs` - Log summary (90% token reduction)

### Services
- `k8s_list_services` - List services
- `k8s_get_service` - Get service details
- `k8s_get_service_endpoints` - Get endpoints

### ConfigMaps & Secrets
- `k8s_list_configmaps` / `k8s_list_secrets`
- `k8s_get_configmap` / `k8s_get_secret`
- `k8s_create_configmap` / `k8s_create_secret`
- `k8s_update_configmap` / `k8s_update_secret`
- `k8s_delete_configmap` / `k8s_delete_secret`

### Namespaces
- `k8s_list_namespaces` - List all namespaces
- `k8s_get_namespace` - Get namespace details
- `k8s_create_namespace` - Create namespace
- `k8s_delete_namespace` - Delete namespace

### Metrics
- `k8s_get_pod_metrics` - Pod CPU/memory usage
- `k8s_get_node_metrics` - Node resource usage
- `k8s_get_deployment_metrics` - Deployment aggregated metrics

### Events
- `k8s_get_events` - Get cluster events
- `k8s_get_resource_events` - Events for specific resource
- `k8s_get_recent_events` - Recent events by timestamp

## Token Optimization

### TOON Format
Automatically uses [TOON](https://github.com/johannschopplich/toon) for 50-60% token reduction on list operations.

### Log Filtering
Reduce log tokens by 80-95%:
- **Severity filtering**: `severityFilter: "ERROR"`
- **Time filtering**: `sinceSeconds: 3600`
- **Pattern matching**: `grep: "error|timeout"`
- **Size limits**: `tail: 100`, `maxBytes: 50000`

### Log Summarization
Use `k8s_summarize_pod_logs` for 90%+ token reduction - get error counts, patterns, and samples without fetching full logs.

## Troubleshooting

**Cannot connect to cluster:**
- Local: Verify `~/.kube/config` exists
- Multipass: Check `multipass list` and VM name

**Metrics not available:**
```bash
multipass exec <vm-name> -- sudo microk8s enable metrics-server
```

## Development

```bash
git clone https://github.com/icy-r/kubemcp.git
cd kubemcp
pnpm install
pnpm run build
pnpm start
```

### Scripts
- `pnpm run dev` - Development with auto-reload
- `pnpm run build` - Build TypeScript
- `pnpm test` - Run tests
- `pnpm run lint` - Lint code
- `pnpm run audit` - Run security audit
- `pnpm run security:check` - Full security check (audit + outdated packages)

## Security

### Automated Security Monitoring

This project implements multiple layers of security protection:

1. **GitHub Dependabot** - Automatically creates PRs for security updates weekly
2. **GitHub Actions** - Runs security audits on every push and weekly scheduled scans
3. **Pre-commit Hooks** - Blocks commits with high/critical vulnerabilities
4. **Manual Audits** - Run `pnpm run audit` anytime to check for vulnerabilities

### Security Best Practices

- Dependencies are regularly audited for known vulnerabilities
- Lockfile (`pnpm-lock.yaml`) is committed to ensure consistent builds
- Security updates are reviewed and applied promptly
- Only essential dependencies are included to minimize attack surface

### Reporting Security Issues

If you discover a security vulnerability, please email the maintainer directly rather than opening a public issue.

## Requirements

- Node.js >= 18.0.0
- kubectl configured (local mode)
- Multipass + MicroK8s (VM mode)

## License

MIT

---

**[Report Issues](https://github.com/icy-r/kubemcp/issues)** | **[NPM Package](https://www.npmjs.com/package/kubemcp)**
