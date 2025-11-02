import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import type { PodInfo } from '../types/index.js';

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
    const response = await coreApi.listNamespacedPod(
      ns,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    );

    return response.body.items.map((pod) => {
      const containerStatuses = pod.status?.containerStatuses || [];
      const totalContainers = containerStatuses.length;
      const readyContainers = containerStatuses.filter((c) => c.ready).length;
      const restarts = containerStatuses.reduce(
        (sum, c) => sum + c.restartCount,
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
    const response = await coreApi.readNamespacedPod(name, ns);
    return response.body;
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
    await coreApi.deleteNamespacedPod(name, ns);
    return `Pod '${name}' deleted successfully`;
  } catch (error) {
    throw new Error(`Failed to delete pod '${name}': ${handleK8sError(error)}`);
  }
}

/**
 * Get pod logs
 */
export async function getPodLogs(
  name: string,
  namespace?: string,
  container?: string,
  tail?: number,
  previous?: boolean
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.readNamespacedPodLog(
      name,
      ns,
      container,
      undefined,
      undefined,
      undefined,
      undefined,
      previous,
      undefined,
      tail,
      undefined
    );
    return response.body;
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
    const response = await coreApi.readNamespacedPod(name, ns);
    const pod = response.body;

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
      conditions: conditions.map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
        lastTransitionTime: c.lastTransitionTime,
      })),
      containerStatuses: containerStatuses.map((c) => ({
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
