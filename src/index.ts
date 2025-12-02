#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { formatResponse } from './utils/formatter.js';
import { config } from './config/settings.js';

// Import consolidated tools
import {
  allToolDefinitions,
  handleDeployments,
  handlePods,
  handleServices,
  handleConfigMaps,
  handleSecrets,
  handleNamespaces,
  handleMetrics,
  handleEvents,
  handleAudit,
} from './tools/consolidated/index.js';

/**
 * MCP Server for Kubernetes Management
 */
class KubeMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'kube-mcp',
        version: '2.0.0',
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
    return allToolDefinitions as Tool[];
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
        case 'k8s_deployments':
          result = await handleDeployments(
            args as Parameters<typeof handleDeployments>[0]
          );
          break;

        case 'k8s_pods':
          result = await handlePods(args as Parameters<typeof handlePods>[0]);
          break;

        case 'k8s_services':
          result = await handleServices(
            args as Parameters<typeof handleServices>[0]
          );
          break;

        case 'k8s_configmaps':
          result = await handleConfigMaps(
            args as Parameters<typeof handleConfigMaps>[0]
          );
          break;

        case 'k8s_secrets':
          result = await handleSecrets(
            args as Parameters<typeof handleSecrets>[0]
          );
          break;

        case 'k8s_namespaces':
          result = await handleNamespaces(
            args as Parameters<typeof handleNamespaces>[0]
          );
          break;

        case 'k8s_metrics':
          result = await handleMetrics(
            args as Parameters<typeof handleMetrics>[0]
          );
          break;

        case 'k8s_events':
          result = await handleEvents(
            args as Parameters<typeof handleEvents>[0]
          );
          break;

        case 'k8s_audit':
          result = await handleAudit(args as Parameters<typeof handleAudit>[0]);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: formatResponse(result, config.responseFormat),
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
