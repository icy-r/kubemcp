/**
 * Consolidated Kubernetes Deployments Tool
 * Combines: list, get, scale, restart, get_status, get_metrics
 */

import { z } from 'zod';
import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../../utils/k8s-client.js';
import { config } from '../../config/settings.js';
import {
  logAudit,
  isDryRunMode,
  validateConfirmation,
  createDryRunSummary,
  type AuditAction,
} from '../../utils/audit.js';
import type { DeploymentInfo, ResourceMetrics } from '../../types/index.js';

// Input schema for the consolidated tool
export const DeploymentsInputSchema = z.object({
  action: z
    .enum(['list', 'get', 'scale', 'restart', 'get_status', 'get_metrics'])
    .describe('Action to perform'),
  name: z
    .string()
    .optional()
    .describe('Deployment name (required for most actions except list)'),
  namespace: z.string().optional().describe('Namespace (optional)'),
  replicas: z
    .number()
    .optional()
    .describe('Number of replicas (required for scale action)'),
  confirm: z
    .boolean()
    .optional()
    .describe(
      'Confirm destructive action (required for scale/restart unless dryRun=true)'
    ),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview changes without executing (default: false)'),
});

export type DeploymentsInput = z.infer<typeof DeploymentsInputSchema>;

/**
 * Calculate age from timestamp
 */
function calculateAge(timestamp?: Date | string): string {
  if (!timestamp) return 'unknown';

  const created = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return '<1m';
}

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
 * List all deployments in a namespace
 */
async function listDeployments(namespace?: string): Promise<DeploymentInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const appsApi = k8sClient.getAppsApi();
  const response = await appsApi.listNamespacedDeployment({ namespace: ns });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.items.map((deployment: any) => {
    const replicas = deployment.spec?.replicas || 0;
    const ready = deployment.status?.readyReplicas || 0;
    const upToDate = deployment.status?.updatedReplicas || 0;
    const available = deployment.status?.availableReplicas || 0;
    const age = calculateAge(deployment.metadata?.creationTimestamp);

    return {
      name: deployment.metadata?.name || 'unknown',
      namespace: deployment.metadata?.namespace || ns,
      ready: `${ready}/${replicas}`,
      upToDate,
      available,
      age,
      replicas,
    };
  });
}

/**
 * Get details of a specific deployment
 */
async function getDeployment(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const appsApi = k8sClient.getAppsApi();
  const response = await appsApi.readNamespacedDeployment({
    name,
    namespace: ns,
  });
  return response;
}

/**
 * Scale a deployment
 */
async function scaleDeployment(
  name: string,
  replicas: number,
  namespace?: string,
  dryRun?: boolean,
  confirm?: boolean
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  // Validate confirmation
  const validation = validateConfirmation(
    'scale' as AuditAction,
    confirm,
    dryRun
  );
  if (!validation.valid) {
    return validation.error!;
  }

  // Check dry-run mode
  if (dryRun || isDryRunMode()) {
    logAudit({
      action: 'scale',
      resource: 'deployment',
      name,
      namespace: ns,
      input: { replicas },
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('scale', 'deployment', name, ns, { replicas });
  }

  const appsApi = k8sClient.getAppsApi();
  const deployment = await appsApi.readNamespacedDeployment({
    name,
    namespace: ns,
  });
  deployment.spec!.replicas = replicas;

  await appsApi.replaceNamespacedDeployment({
    name,
    namespace: ns,
    body: deployment,
  });

  logAudit({
    action: 'scale',
    resource: 'deployment',
    name,
    namespace: ns,
    input: { replicas },
    result: 'success',
    dryRun: false,
  });

  return `Deployment '${name}' scaled to ${replicas} replicas`;
}

/**
 * Restart a deployment
 */
async function restartDeployment(
  name: string,
  namespace?: string,
  dryRun?: boolean,
  confirm?: boolean
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  // Validate confirmation
  const validation = validateConfirmation(
    'restart' as AuditAction,
    confirm,
    dryRun
  );
  if (!validation.valid) {
    return validation.error!;
  }

  // Check dry-run mode
  if (dryRun || isDryRunMode()) {
    logAudit({
      action: 'restart',
      resource: 'deployment',
      name,
      namespace: ns,
      input: {},
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('restart', 'deployment', name, ns, {
      annotation: 'kubectl.kubernetes.io/restartedAt',
    });
  }

  const appsApi = k8sClient.getAppsApi();
  const deployment = await appsApi.readNamespacedDeployment({
    name,
    namespace: ns,
  });

  if (!deployment.spec?.template.metadata) {
    deployment.spec!.template.metadata = {};
  }
  if (!deployment.spec?.template.metadata.annotations) {
    deployment.spec!.template.metadata.annotations = {};
  }

  deployment.spec!.template.metadata.annotations[
    'kubectl.kubernetes.io/restartedAt'
  ] = new Date().toISOString();

  await appsApi.replaceNamespacedDeployment({
    name,
    namespace: ns,
    body: deployment,
  });

  logAudit({
    action: 'restart',
    resource: 'deployment',
    name,
    namespace: ns,
    input: {},
    result: 'success',
    dryRun: false,
  });

  return `Deployment '${name}' restart initiated`;
}

/**
 * Get deployment rollout status
 */
async function getDeploymentStatus(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const appsApi = k8sClient.getAppsApi();
  const deployment = await appsApi.readNamespacedDeployment({
    name,
    namespace: ns,
  });

  const replicas = deployment.spec?.replicas || 0;
  const ready = deployment.status?.readyReplicas || 0;
  const upToDate = deployment.status?.updatedReplicas || 0;
  const available = deployment.status?.availableReplicas || 0;
  const conditions = deployment.status?.conditions || [];

  return {
    name: deployment.metadata?.name,
    namespace: deployment.metadata?.namespace,
    replicas: { desired: replicas, ready, upToDate, available },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions: conditions.map((c: any) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
      lastUpdateTime: c.lastUpdateTime,
    })),
  };
}

/**
 * Get deployment metrics
 */
async function getDeploymentMetrics(
  name: string,
  namespace?: string
): Promise<ResourceMetrics[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const appsApi = k8sClient.getAppsApi();
  const deployment = await appsApi.readNamespacedDeployment({
    name,
    namespace: ns,
  });

  const labelSelector = deployment.spec?.selector?.matchLabels;
  if (!labelSelector) {
    throw new Error('Deployment has no label selector');
  }

  const selector = Object.entries(labelSelector)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

  const coreApi = k8sClient.getCoreApi();
  const pods = await coreApi.listNamespacedPod({
    namespace: ns,
    labelSelector: selector,
  });

  const metricsApi = k8sClient.getMetricsApi();
  const metrics: ResourceMetrics[] = [];
  const allPodMetrics = await metricsApi.getPodMetrics(ns);

  for (const pod of pods.items) {
    const podMetrics = allPodMetrics.items.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => m.metadata.name === pod.metadata?.name
    );
    if (podMetrics) {
      metrics.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: (podMetrics as any).metadata.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        namespace: (podMetrics as any).metadata.namespace,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cpu: formatCpuUsage((podMetrics as any).containers),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memory: formatMemoryUsage((podMetrics as any).containers),
      });
    }
  }

  return metrics;
}

/**
 * Handle the consolidated deployments tool
 */
export async function handleDeployments(
  params: DeploymentsInput
): Promise<unknown> {
  const { action, name, namespace, replicas, confirm, dryRun } = params;

  try {
    switch (action) {
      case 'list':
        return await listDeployments(namespace);

      case 'get':
        if (!name) throw new Error('name is required for get action');
        return await getDeployment(name, namespace);

      case 'scale':
        if (!name) throw new Error('name is required for scale action');
        if (replicas === undefined)
          throw new Error('replicas is required for scale action');
        return await scaleDeployment(
          name,
          replicas,
          namespace,
          dryRun,
          confirm
        );

      case 'restart':
        if (!name) throw new Error('name is required for restart action');
        return await restartDeployment(name, namespace, dryRun, confirm);

      case 'get_status':
        if (!name) throw new Error('name is required for get_status action');
        return await getDeploymentStatus(name, namespace);

      case 'get_metrics':
        if (!name) throw new Error('name is required for get_metrics action');
        return await getDeploymentMetrics(name, namespace);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logAudit({
      action: action as AuditAction,
      resource: 'deployment',
      name: name || 'unknown',
      namespace,
      input: params,
      result: 'failure',
      error: handleK8sError(error),
      dryRun: dryRun || false,
    });
    throw new Error(`Failed to ${action} deployment: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const deploymentsToolDefinition = {
  name: 'k8s_deployments',
  description: `Manage Kubernetes deployments. Actions:
- list: List all deployments in a namespace
- get: Get deployment details
- scale: Scale deployment replicas (requires confirm=true or dryRun=true)
- restart: Perform rolling restart (requires confirm=true or dryRun=true)
- get_status: Get rollout status
- get_metrics: Get aggregated metrics for a deployment`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'scale', 'restart', 'get_status', 'get_metrics'],
        description: 'Action to perform',
      },
      name: {
        type: 'string',
        description: 'Deployment name (required for most actions except list)',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (optional)',
      },
      replicas: {
        type: 'number',
        description: 'Number of replicas (required for scale action)',
      },
      confirm: {
        type: 'boolean',
        description:
          'Confirm destructive action (required for scale/restart unless dryRun=true)',
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Preview changes without executing (default: false)',
      },
    },
    required: ['action'],
  },
};
