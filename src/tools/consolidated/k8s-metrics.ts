/**
 * Consolidated Kubernetes Metrics Tool
 * Combines: get_pod_metrics, get_node_metrics
 */

import { z } from 'zod';
import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../../utils/k8s-client.js';
import { config } from '../../config/settings.js';
import type { ResourceMetrics } from '../../types/index.js';

// Input schema for the consolidated tool
export const MetricsInputSchema = z.object({
  action: z
    .enum(['get_pod_metrics', 'get_node_metrics'])
    .describe('Action to perform'),
  namespace: z
    .string()
    .optional()
    .describe('Namespace (optional, for pod metrics)'),
  podName: z.string().optional().describe('Specific pod name (optional)'),
  nodeName: z.string().optional().describe('Specific node name (optional)'),
});

export type MetricsInput = z.infer<typeof MetricsInputSchema>;

/**
 * Format CPU usage from containers
 */
function formatCpuUsage(containers: Array<{ usage: { cpu: string } }>): string {
  const totalNanocores = containers.reduce((sum, container) => {
    const usage = container.usage.cpu;
    if (usage.endsWith('n')) return sum + parseInt(usage);
    else if (usage.endsWith('u')) return sum + parseInt(usage) * 1000;
    else if (usage.endsWith('m')) return sum + parseInt(usage) * 1000000;
    return sum + parseInt(usage) * 1000000000;
  }, 0);

  const millicores = Math.round(totalNanocores / 1000000);
  return `${millicores}m`;
}

/**
 * Format memory usage from containers
 */
function formatMemoryUsage(
  containers: Array<{ usage: { memory: string } }>
): string {
  const totalBytes = containers.reduce((sum, container) => {
    const usage = container.usage.memory;
    if (usage.endsWith('Ki')) return sum + parseInt(usage) * 1024;
    else if (usage.endsWith('Mi')) return sum + parseInt(usage) * 1024 * 1024;
    else if (usage.endsWith('Gi'))
      return sum + parseInt(usage) * 1024 * 1024 * 1024;
    return sum + parseInt(usage);
  }, 0);

  if (totalBytes >= 1024 * 1024 * 1024) {
    return `${Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100}Gi`;
  } else if (totalBytes >= 1024 * 1024) {
    return `${Math.round(totalBytes / (1024 * 1024))}Mi`;
  }
  return `${Math.round(totalBytes / 1024)}Ki`;
}

/**
 * Get pod metrics
 */
async function getPodMetrics(
  namespace?: string,
  podName?: string
): Promise<ResourceMetrics[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const metricsApi = k8sClient.getMetricsApi();

  if (podName) {
    // Get metrics for specific pod
    const response = await metricsApi.getPodMetrics(ns);

    const podMetrics = response.items.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => item.metadata.name === podName
    );
    if (!podMetrics) {
      throw new Error(`Metrics not found for pod ${podName}`);
    }
    return [
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: (podMetrics as any).metadata.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        namespace: (podMetrics as any).metadata.namespace,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cpu: formatCpuUsage((podMetrics as any).containers),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memory: formatMemoryUsage((podMetrics as any).containers),
      },
    ];
  } else {
    // Get metrics for all pods in namespace
    const response = await metricsApi.getPodMetrics(ns);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.items.map((podMetrics: any) => ({
      name: podMetrics.metadata.name,
      namespace: podMetrics.metadata.namespace,
      cpu: formatCpuUsage(podMetrics.containers),
      memory: formatMemoryUsage(podMetrics.containers),
    }));
  }
}

/**
 * Get node metrics
 */
async function getNodeMetrics(nodeName?: string): Promise<ResourceMetrics[]> {
  await ensureInitialized();

  const metricsApi = k8sClient.getMetricsApi();
  const response = await metricsApi.getNodeMetrics();

  if (nodeName) {
    // Filter for specific node
    const nodeMetrics = response.items.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => item.metadata.name === nodeName
    );
    if (!nodeMetrics) {
      throw new Error(`Metrics not found for node ${nodeName}`);
    }
    return [
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: (nodeMetrics as any).metadata.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cpu: (nodeMetrics as any).usage.cpu,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memory: (nodeMetrics as any).usage.memory,
      },
    ];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.items.map((node: any) => ({
      name: node.metadata.name,
      cpu: node.usage.cpu,
      memory: node.usage.memory,
    }));
  }
}

/**
 * Handle the consolidated metrics tool
 */
export async function handleMetrics(params: MetricsInput): Promise<unknown> {
  const { action, namespace, podName, nodeName } = params;

  try {
    switch (action) {
      case 'get_pod_metrics':
        return await getPodMetrics(namespace, podName);

      case 'get_node_metrics':
        return await getNodeMetrics(nodeName);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw new Error(`Failed to ${action}: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const metricsToolDefinition = {
  name: 'k8s_metrics',
  description: `Get Kubernetes resource metrics (CPU/Memory). Actions:
- get_pod_metrics: Get resource metrics for pods
- get_node_metrics: Get resource metrics for nodes`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get_pod_metrics', 'get_node_metrics'],
        description: 'Action to perform',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (optional, for pod metrics)',
      },
      podName: {
        type: 'string',
        description: 'Specific pod name (optional)',
      },
      nodeName: {
        type: 'string',
        description: 'Specific node name (optional)',
      },
    },
    required: ['action'],
  },
};
