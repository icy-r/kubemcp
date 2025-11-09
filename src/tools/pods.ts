import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import {
  processLogs,
  summarizeLogs,
  type LogSeverity,
} from '../utils/log-processor.js';
import type { PodInfo, LogSummary } from '../types/index.js';

/**
 * List all pods in a namespace with optional label selector
 */
export async function listPods(
  namespace?: string,
  labelSelector?: string
): Promise<PodInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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
  } catch (error) {
    throw new Error(`Failed to list pods: ${handleK8sError(error)}`);
  }
}

/**
 * Get details of a specific pod
 */
export async function getPod(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.readNamespacedPod({ name, namespace: ns });
    return response;
  } catch (error) {
    throw new Error(`Failed to get pod '${name}': ${handleK8sError(error)}`);
  }
}

/**
 * Delete a pod (to force restart)
 */
export async function deletePod(
  name: string,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    await coreApi.deleteNamespacedPod({ name, namespace: ns });
    return `Pod '${name}' deleted successfully`;
  } catch (error) {
    throw new Error(`Failed to delete pod '${name}': ${handleK8sError(error)}`);
  }
}

/**
 * Get pod logs with advanced filtering
 */
export async function getPodLogs(
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

  // Use configured defaults if not specified
  const effectiveTail = tail !== undefined ? tail : config.logMaxLines;
  const effectiveMaxBytes =
    maxBytes !== undefined ? maxBytes : config.logMaxBytes;
  const effectiveSeverity = severityFilter || config.logDefaultSeverity;

  try {
    const coreApi = k8sClient.getCoreApi();

    // Parse sinceTime if provided
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

    // Apply filters if specified
    if (effectiveSeverity || grep || effectiveMaxBytes) {
      const processed = processLogs(logs, {
        severityFilter: effectiveSeverity,
        grep,
        maxBytes: effectiveMaxBytes,
      });

      logs = processed.logs;

      // Add metadata footer if logs were truncated
      if (processed.metadata.truncated) {
        logs += `\n\n[INFO] Logs truncated. Original size: ${processed.metadata.originalSize} bytes`;
      }
    }

    return logs;
  } catch (error) {
    throw new Error(
      `Failed to get logs for pod '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Get pod status details
 */
export async function getPodStatus(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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
  } catch (error) {
    throw new Error(
      `Failed to get pod status for '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Summarize pod logs instead of returning full content
 * Much more token-efficient for large log volumes
 */
export async function summarizePodLogs(
  name: string,
  namespace?: string,
  container?: string,
  tail?: number,
  sinceSeconds?: number
): Promise<LogSummary> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();

    // Get logs (use tail to limit if specified)
    const response = await coreApi.readNamespacedPodLog({
      name,
      namespace: ns,
      container,
      previous: false,
      sinceSeconds,
      tailLines: tail,
    });

    const logs = response;

    // Generate summary
    return summarizeLogs(logs);
  } catch (error) {
    throw new Error(
      `Failed to summarize logs for pod '${name}': ${handleK8sError(error)}`
    );
  }
}

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
