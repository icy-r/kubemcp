#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Import all tool functions
import * as deployments from './tools/deployments.js';
import * as pods from './tools/pods.js';
import * as services from './tools/services.js';
import * as configmaps from './tools/configmaps.js';
import * as secrets from './tools/secrets.js';
import * as namespaces from './tools/namespaces.js';
import * as metrics from './tools/metrics.js';
import * as events from './tools/events.js';

/**
 * MCP Server for MicroK8s Management
 */
class KubeMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'kubemcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleToolCall(request)
    );
  }

  private getTools(): Tool[] {
    return [
      // Deployment tools
      {
        name: 'k8s_list_deployments',
        description: 'List all deployments in a namespace',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace to list deployments from (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_deployment',
        description: 'Get details of a specific deployment',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Deployment name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_scale_deployment',
        description: 'Scale a deployment to a specified number of replicas',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Deployment name' },
            replicas: {
              type: 'number',
              description: 'Number of replicas',
            },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name', 'replicas'],
        },
      },
      {
        name: 'k8s_restart_deployment',
        description: 'Perform a rolling restart of a deployment',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Deployment name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_get_deployment_status',
        description: 'Get the rollout status of a deployment',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Deployment name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },

      // Pod tools
      {
        name: 'k8s_list_pods',
        description:
          'List all pods in a namespace with optional label selector',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
            labelSelector: {
              type: 'string',
              description: 'Label selector (e.g., "app=nginx") (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_pod',
        description: 'Get details of a specific pod',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Pod name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_delete_pod',
        description: 'Delete a pod (to force restart)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Pod name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_get_pod_logs',
        description: 'Get logs from a pod',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Pod name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
            container: {
              type: 'string',
              description: 'Container name (optional)',
            },
            tail: {
              type: 'number',
              description: 'Number of lines to tail (optional)',
            },
            previous: {
              type: 'boolean',
              description:
                'Get logs from previous container instance (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_get_pod_status',
        description: 'Get detailed status of a pod',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Pod name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },

      // Service tools
      {
        name: 'k8s_list_services',
        description: 'List all services in a namespace',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_service',
        description: 'Get details of a specific service',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Service name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_get_service_endpoints',
        description: 'Get endpoints for a service',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Service name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },

      // ConfigMap tools
      {
        name: 'k8s_list_configmaps',
        description: 'List all ConfigMaps in a namespace',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_configmap',
        description: 'Get a specific ConfigMap',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'ConfigMap name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_create_configmap',
        description: 'Create a new ConfigMap',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'ConfigMap name' },
            data: {
              type: 'object',
              description: 'ConfigMap data as key-value pairs',
            },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name', 'data'],
        },
      },
      {
        name: 'k8s_update_configmap',
        description: 'Update an existing ConfigMap',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'ConfigMap name' },
            data: {
              type: 'object',
              description: 'New ConfigMap data',
            },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name', 'data'],
        },
      },
      {
        name: 'k8s_delete_configmap',
        description: 'Delete a ConfigMap',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'ConfigMap name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },

      // Secret tools
      {
        name: 'k8s_list_secrets',
        description: 'List all Secrets in a namespace',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_secret',
        description: 'Get a specific Secret (metadata only, no data)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Secret name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_create_secret',
        description: 'Create a new Secret',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Secret name' },
            data: {
              type: 'object',
              description: 'Secret data as key-value pairs',
            },
            type: {
              type: 'string',
              description: 'Secret type (default: Opaque)',
            },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name', 'data'],
        },
      },
      {
        name: 'k8s_update_secret',
        description: 'Update an existing Secret',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Secret name' },
            data: {
              type: 'object',
              description: 'New Secret data',
            },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name', 'data'],
        },
      },
      {
        name: 'k8s_delete_secret',
        description: 'Delete a Secret',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Secret name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },

      // Namespace tools
      {
        name: 'k8s_list_namespaces',
        description: 'List all namespaces in the cluster',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'k8s_get_namespace',
        description: 'Get details of a specific namespace',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Namespace name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_create_namespace',
        description: 'Create a new namespace',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Namespace name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'k8s_delete_namespace',
        description: 'Delete a namespace',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Namespace name' },
          },
          required: ['name'],
        },
      },

      // Metrics tools
      {
        name: 'k8s_get_pod_metrics',
        description: 'Get resource metrics (CPU/Memory) for pods',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
            podName: {
              type: 'string',
              description: 'Specific pod name (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_node_metrics',
        description: 'Get resource metrics for nodes',
        inputSchema: {
          type: 'object',
          properties: {
            nodeName: {
              type: 'string',
              description: 'Specific node name (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_deployment_metrics',
        description: 'Get aggregated metrics for a deployment',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Deployment name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['name'],
        },
      },

      // Event tools
      {
        name: 'k8s_get_events',
        description: 'Get cluster events',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
            fieldSelector: {
              type: 'string',
              description: 'Field selector for filtering (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of events to return (optional)',
            },
          },
        },
      },
      {
        name: 'k8s_get_resource_events',
        description: 'Get events for a specific resource',
        inputSchema: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              description: 'Resource kind (e.g., Pod, Deployment)',
            },
            name: { type: 'string', description: 'Resource name' },
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
          },
          required: ['kind', 'name'],
        },
      },
      {
        name: 'k8s_get_recent_events',
        description: 'Get recent events sorted by timestamp',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Namespace (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of events (default: 50)',
            },
          },
        },
      },
    ];
  }

  private async handleToolCall(
    request: unknown
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const req = request as {
      params: { name: string; arguments?: Record<string, unknown> };
    };
    const { name, arguments: args = {} } = req.params;

    try {
      let result: unknown;

      switch (name) {
        // Deployment tools
        case 'k8s_list_deployments':
          result = await deployments.listDeployments(args.namespace as string);
          break;
        case 'k8s_get_deployment':
          result = await deployments.getDeployment(
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_scale_deployment':
          result = await deployments.scaleDeployment(
            args.name as string,
            args.replicas as number,
            args.namespace as string
          );
          break;
        case 'k8s_restart_deployment':
          result = await deployments.restartDeployment(
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_get_deployment_status':
          result = await deployments.getDeploymentStatus(
            args.name as string,
            args.namespace as string
          );
          break;

        // Pod tools
        case 'k8s_list_pods':
          result = await pods.listPods(
            args.namespace as string,
            args.labelSelector as string
          );
          break;
        case 'k8s_get_pod':
          result = await pods.getPod(
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_delete_pod':
          result = await pods.deletePod(
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_get_pod_logs':
          result = await pods.getPodLogs(
            args.name as string,
            args.namespace as string,
            args.container as string,
            args.tail as number,
            args.previous as boolean
          );
          break;
        case 'k8s_get_pod_status':
          result = await pods.getPodStatus(
            args.name as string,
            args.namespace as string
          );
          break;

        // Service tools
        case 'k8s_list_services':
          result = await services.listServices(args.namespace as string);
          break;
        case 'k8s_get_service':
          result = await services.getService(
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_get_service_endpoints':
          result = await services.getServiceEndpoints(
            args.name as string,
            args.namespace as string
          );
          break;

        // ConfigMap tools
        case 'k8s_list_configmaps':
          result = await configmaps.listConfigMaps(args.namespace as string);
          break;
        case 'k8s_get_configmap':
          result = await configmaps.getConfigMap(
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_create_configmap':
          result = await configmaps.createConfigMap(
            args.name as string,
            args.data as Record<string, string>,
            args.namespace as string
          );
          break;
        case 'k8s_update_configmap':
          result = await configmaps.updateConfigMap(
            args.name as string,
            args.data as Record<string, string>,
            args.namespace as string
          );
          break;
        case 'k8s_delete_configmap':
          result = await configmaps.deleteConfigMap(
            args.name as string,
            args.namespace as string
          );
          break;

        // Secret tools
        case 'k8s_list_secrets':
          result = await secrets.listSecrets(args.namespace as string);
          break;
        case 'k8s_get_secret':
          result = await secrets.getSecret(
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_create_secret':
          result = await secrets.createSecret(
            args.name as string,
            args.data as Record<string, string>,
            args.type as string,
            args.namespace as string
          );
          break;
        case 'k8s_update_secret':
          result = await secrets.updateSecret(
            args.name as string,
            args.data as Record<string, string>,
            args.namespace as string
          );
          break;
        case 'k8s_delete_secret':
          result = await secrets.deleteSecret(
            args.name as string,
            args.namespace as string
          );
          break;

        // Namespace tools
        case 'k8s_list_namespaces':
          result = await namespaces.listNamespaces();
          break;
        case 'k8s_get_namespace':
          result = await namespaces.getNamespace(args.name as string);
          break;
        case 'k8s_create_namespace':
          result = await namespaces.createNamespace(args.name as string);
          break;
        case 'k8s_delete_namespace':
          result = await namespaces.deleteNamespace(args.name as string);
          break;

        // Metrics tools
        case 'k8s_get_pod_metrics':
          result = await metrics.getPodMetrics(
            args.namespace as string,
            args.podName as string
          );
          break;
        case 'k8s_get_node_metrics':
          result = await metrics.getNodeMetrics(args.nodeName as string);
          break;
        case 'k8s_get_deployment_metrics':
          result = await metrics.getDeploymentMetrics(
            args.name as string,
            args.namespace as string
          );
          break;

        // Event tools
        case 'k8s_get_events':
          result = await events.getEvents(
            args.namespace as string,
            args.fieldSelector as string,
            args.limit as number
          );
          break;
        case 'k8s_get_resource_events':
          result = await events.getResourceEvents(
            args.kind as string,
            args.name as string,
            args.namespace as string
          );
          break;
        case 'k8s_get_recent_events':
          result = await events.getRecentEvents(
            args.namespace as string,
            args.limit as number
          );
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
      };
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('KubeMCP server running on stdio');
  }
}

// Start the server
const server = new KubeMcpServer();
server.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
