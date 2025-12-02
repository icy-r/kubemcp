/**
 * Consolidated Kubernetes Pods Tool
 * Combines: list, get, delete, get_logs, get_status, summarize_logs
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
import {
  processLogs,
  summarizeLogs,
  type LogSeverity,
} from '../../utils/log-processor.js';
import type { PodInfo, LogSummary } from '../../types/index.js';

// Input schema for the consolidated tool
export const PodsInputSchema = z.object({
  action: z
    .enum(['list', 'get', 'delete', 'get_logs', 'get_status', 'summarize_logs'])
    .describe('Action to perform'),
  name: z
    .string()
    .optional()
    .describe('Pod name (required for most actions except list)'),
  namespace: z.string().optional().describe('Namespace (optional)'),
  labelSelector: z
    .string()
    .optional()
    .describe('Label selector for list action (e.g., "app=nginx")'),
  container: z
    .string()
    .optional()
    .describe('Container name for logs (optional)'),
  tail: z.number().optional().describe('Number of log lines to tail'),
  previous: z
    .boolean()
    .optional()
    .describe('Get logs from previous container instance'),
  sinceSeconds: z
    .number()
    .optional()
    .describe('Only return logs newer than this many seconds'),
  sinceTime: z
    .string()
    .optional()
    .describe('Only return logs after this ISO 8601 timestamp'),
  grep: z.string().optional().describe('Filter logs with regex pattern'),
  severityFilter: z
    .enum(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'])
    .optional()
    .describe('Only show logs at or above this severity level'),
  maxBytes: z.number().optional().describe('Maximum response size in bytes'),
  confirm: z
    .boolean()
    .optional()
    .describe(
      'Confirm destructive action (required for delete unless dryRun=true)'
    ),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview changes without executing (default: false)'),
});

export type PodsInput = z.infer<typeof PodsInputSchema>;

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
 * List all pods in a namespace
 */
async function listPods(
  namespace?: string,
  labelSelector?: string
): Promise<PodInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.listNamespacedPod({
    namespace: ns,
    labelSelector,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.items.map((pod: any) => {
    const containerStatuses = pod.status?.containerStatuses || [];
    const totalContainers = containerStatuses.length;

    const readyContainers = containerStatuses.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c.ready
    ).length;

    const restarts = containerStatuses.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, c: any) => sum + c.restartCount,
      0
    );
    const age = calculateAge(pod.metadata?.creationTimestamp);

    return {
      name: pod.metadata?.name || 'unknown',
      namespace: pod.metadata?.namespace || ns,
      status: pod.status?.phase || 'Unknown',
      ready: `${readyContainers}/${totalContainers}`,
      restarts,
      age,
      ip: pod.status?.podIP,
      node: pod.spec?.nodeName,
    };
  });
}

/**
 * Get details of a specific pod
 */
async function getPod(name: string, namespace?: string): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.readNamespacedPod({ name, namespace: ns });
  return response;
}

/**
 * Delete a pod
 */
async function deletePod(
  name: string,
  namespace?: string,
  dryRun?: boolean,
  confirm?: boolean
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  // Validate confirmation
  const validation = validateConfirmation(
    'delete' as AuditAction,
    confirm,
    dryRun
  );
  if (!validation.valid) {
    return validation.error!;
  }

  // Check dry-run mode
  if (dryRun || isDryRunMode()) {
    logAudit({
      action: 'delete',
      resource: 'pod',
      name,
      namespace: ns,
      input: {},
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('delete', 'pod', name, ns, {});
  }

  const coreApi = k8sClient.getCoreApi();
  await coreApi.deleteNamespacedPod({ name, namespace: ns });

  logAudit({
    action: 'delete',
    resource: 'pod',
    name,
    namespace: ns,
    input: {},
    result: 'success',
    dryRun: false,
  });

  return `Pod '${name}' deleted successfully`;
}

/**
 * Get pod logs with filtering
 */
async function getPodLogs(
  name: string,
  namespace?: string,
  container?: string,
  tail?: number,
  previous?: boolean,
  sinceSeconds?: number,
  sinceTime?: string,
  grep?: string,
  severityFilter?: LogSeverity,
  maxBytes?: number
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const effectiveTail = tail !== undefined ? tail : config.logMaxLines;
  const effectiveMaxBytes =
    maxBytes !== undefined ? maxBytes : config.logMaxBytes;
  const effectiveSeverity = severityFilter || config.logDefaultSeverity;

  const coreApi = k8sClient.getCoreApi();

  let sinceSecondsValue = sinceSeconds;
  if (sinceTime && !sinceSeconds) {
    const timestamp = new Date(sinceTime);
    const now = new Date();
    sinceSecondsValue = Math.floor(
      (now.getTime() - timestamp.getTime()) / 1000
    );
  }

  const response = await coreApi.readNamespacedPodLog({
    name,
    namespace: ns,
    container,
    previous,
    sinceSeconds: sinceSecondsValue,
    tailLines: effectiveTail,
  });

  let logs = response;

  if (effectiveSeverity || grep || effectiveMaxBytes) {
    const processed = processLogs(logs, {
      severityFilter: effectiveSeverity,
      grep,
      maxBytes: effectiveMaxBytes,
    });

    logs = processed.logs;

    if (processed.metadata.truncated) {
      logs += `\n\n[INFO] Logs truncated. Original size: ${processed.metadata.originalSize} bytes`;
    }
  }

  return logs;
}

/**
 * Get pod status details
 */
async function getPodStatus(name: string, namespace?: string): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const pod = await coreApi.readNamespacedPod({ name, namespace: ns });

  const containerStatuses = pod.status?.containerStatuses || [];
  const conditions = pod.status?.conditions || [];

  return {
    name: pod.metadata?.name,
    namespace: pod.metadata?.namespace,
    phase: pod.status?.phase,
    podIP: pod.status?.podIP,
    hostIP: pod.status?.hostIP,
    node: pod.spec?.nodeName,
    startTime: pod.status?.startTime,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions: conditions.map((c: any) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
      lastTransitionTime: c.lastTransitionTime,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    containerStatuses: containerStatuses.map((c: any) => ({
      name: c.name,
      ready: c.ready,
      restartCount: c.restartCount,
      state: c.state,
      image: c.image,
    })),
  };
}

/**
 * Summarize pod logs
 */
async function summarizePodLogs(
  name: string,
  namespace?: string,
  container?: string,
  tail?: number,
  sinceSeconds?: number
): Promise<LogSummary> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.readNamespacedPodLog({
    name,
    namespace: ns,
    container,
    previous: false,
    sinceSeconds,
    tailLines: tail,
  });

  return summarizeLogs(response);
}

/**
 * Handle the consolidated pods tool
 */
export async function handlePods(params: PodsInput): Promise<unknown> {
  const {
    action,
    name,
    namespace,
    labelSelector,
    container,
    tail,
    previous,
    sinceSeconds,
    sinceTime,
    grep,
    severityFilter,
    maxBytes,
    confirm,
    dryRun,
  } = params;

  try {
    switch (action) {
      case 'list':
        return await listPods(namespace, labelSelector);

      case 'get':
        if (!name) throw new Error('name is required for get action');
        return await getPod(name, namespace);

      case 'delete':
        if (!name) throw new Error('name is required for delete action');
        return await deletePod(name, namespace, dryRun, confirm);

      case 'get_logs':
        if (!name) throw new Error('name is required for get_logs action');
        return await getPodLogs(
          name,
          namespace,
          container,
          tail,
          previous,
          sinceSeconds,
          sinceTime,
          grep,
          severityFilter,
          maxBytes
        );

      case 'get_status':
        if (!name) throw new Error('name is required for get_status action');
        return await getPodStatus(name, namespace);

      case 'summarize_logs':
        if (!name)
          throw new Error('name is required for summarize_logs action');
        return await summarizePodLogs(
          name,
          namespace,
          container,
          tail,
          sinceSeconds
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logAudit({
      action: action as AuditAction,
      resource: 'pod',
      name: name || 'unknown',
      namespace,
      input: params,
      result: 'failure',
      error: handleK8sError(error),
      dryRun: dryRun || false,
    });
    throw new Error(`Failed to ${action} pod: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const podsToolDefinition = {
  name: 'k8s_pods',
  description: `Manage Kubernetes pods. Actions:
- list: List pods in a namespace with optional label selector
- get: Get pod details
- delete: Delete a pod (requires confirm=true or dryRun=true)
- get_logs: Get logs with filtering (severity, grep, time-based)
- get_status: Get detailed pod status
- summarize_logs: Get log summary statistics (90%+ token reduction)`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'list',
          'get',
          'delete',
          'get_logs',
          'get_status',
          'summarize_logs',
        ],
        description: 'Action to perform',
      },
      name: {
        type: 'string',
        description: 'Pod name (required for most actions except list)',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (optional)',
      },
      labelSelector: {
        type: 'string',
        description: 'Label selector for list action (e.g., "app=nginx")',
      },
      container: {
        type: 'string',
        description: 'Container name for logs (optional)',
      },
      tail: {
        type: 'number',
        description: 'Number of log lines to tail',
      },
      previous: {
        type: 'boolean',
        description: 'Get logs from previous container instance',
      },
      sinceSeconds: {
        type: 'number',
        description: 'Only return logs newer than this many seconds',
      },
      sinceTime: {
        type: 'string',
        description: 'Only return logs after this ISO 8601 timestamp',
      },
      grep: {
        type: 'string',
        description: 'Filter logs with regex pattern',
      },
      severityFilter: {
        type: 'string',
        enum: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'],
        description: 'Only show logs at or above this severity level',
      },
      maxBytes: {
        type: 'number',
        description: 'Maximum response size in bytes',
      },
      confirm: {
        type: 'boolean',
        description:
          'Confirm destructive action (required for delete unless dryRun=true)',
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
