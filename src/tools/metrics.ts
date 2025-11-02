import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import type { ResourceMetrics } from '../types/index.js';

/**
 * Get pod metrics
 */
export async function getPodMetrics(
  namespace?: string,
  podName?: string
): Promise<ResourceMetrics[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const metricsApi = k8sClient.getMetricsApi();

    if (podName) {
      // Get metrics for specific pod
      const response = await metricsApi.getPodMetrics(ns, podName);
      return [
        {
          name: response.metadata.name,
          namespace: response.metadata.namespace,
          cpu: formatCpuUsage(response.containers),
          memory: formatMemoryUsage(response.containers),
        },
      ];
    } else {
      // Get metrics for all pods in namespace
      // Note: This requires kubectl top pods equivalent
      // For now, return empty array as this requires special API support
      return [];
    }
  } catch (error) {
    throw new Error(`Failed to get pod metrics: ${handleK8sError(error)}`);
  }
}

/**
 * Get node metrics
 */
export async function getNodeMetrics(
  nodeName?: string
): Promise<ResourceMetrics[]> {
  await ensureInitialized();

  try {
    const metricsApi = k8sClient.getMetricsApi();

    if (nodeName) {
      // Get metrics for specific node
      const response = await metricsApi.getNodeMetrics(nodeName);
      return [
        {
          name: response.metadata.name,
          cpu: response.usage.cpu,
          memory: response.usage.memory,
        },
      ];
    } else {
      // Get metrics for all nodes
      const response = await metricsApi.getNodeMetrics();
      return response.items.map((node) => ({
        name: node.metadata.name,
        cpu: node.usage.cpu,
        memory: node.usage.memory,
      }));
    }
  } catch (error) {
    throw new Error(`Failed to get node metrics: ${handleK8sError(error)}`);
  }
}

/**
 * Get aggregated deployment metrics
 */
export async function getDeploymentMetrics(
  name: string,
  namespace?: string
): Promise<ResourceMetrics[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    // First get the deployment to find its pods
    const appsApi = k8sClient.getAppsApi();
    const deployment = await appsApi.readNamespacedDeployment(name, ns);

    const labelSelector = deployment.body.spec?.selector?.matchLabels;
    if (!labelSelector) {
      throw new Error('Deployment has no label selector');
    }

    // Convert labels to selector string
    const selector = Object.entries(labelSelector)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    // Get pods matching the selector
    const coreApi = k8sClient.getCoreApi();
    const pods = await coreApi.listNamespacedPod(
      ns,
      undefined,
      undefined,
      undefined,
      undefined,
      selector
    );

    // Get metrics for each pod
    const metricsApi = k8sClient.getMetricsApi();
    const metrics: ResourceMetrics[] = [];

    for (const pod of pods.body.items) {
      try {
        const podMetrics = await metricsApi.getPodMetrics(
          pod.metadata?.namespace || ns,
          pod.metadata?.name || ''
        );
        metrics.push({
          name: podMetrics.metadata.name,
          namespace: podMetrics.metadata.namespace,
          cpu: formatCpuUsage(podMetrics.containers),
          memory: formatMemoryUsage(podMetrics.containers),
        });
      } catch {
        // Skip pods without metrics
      }
    }

    return metrics;
  } catch (error) {
    throw new Error(
      `Failed to get deployment metrics for '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Format CPU usage from containers
 */
function formatCpuUsage(containers: Array<{ usage: { cpu: string } }>): string {
  const totalNanocores = containers.reduce((sum, container) => {
    const usage = container.usage.cpu;
    // Convert various formats to nanocores
    if (usage.endsWith('n')) {
      return sum + parseInt(usage);
    } else if (usage.endsWith('u')) {
      return sum + parseInt(usage) * 1000;
    } else if (usage.endsWith('m')) {
      return sum + parseInt(usage) * 1000000;
    }
    return sum + parseInt(usage) * 1000000000;
  }, 0);

  // Convert to millicores for display
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
    // Convert various formats to bytes
    if (usage.endsWith('Ki')) {
      return sum + parseInt(usage) * 1024;
    } else if (usage.endsWith('Mi')) {
      return sum + parseInt(usage) * 1024 * 1024;
    } else if (usage.endsWith('Gi')) {
      return sum + parseInt(usage) * 1024 * 1024 * 1024;
    }
    return sum + parseInt(usage);
  }, 0);

  // Convert to appropriate unit
  if (totalBytes >= 1024 * 1024 * 1024) {
    return `${Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100}Gi`;
  } else if (totalBytes >= 1024 * 1024) {
    return `${Math.round(totalBytes / (1024 * 1024))}Mi`;
  } else {
    return `${Math.round(totalBytes / 1024)}Ki`;
  }
}
