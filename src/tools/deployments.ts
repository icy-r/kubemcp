import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import type { DeploymentInfo } from '../types/index.js';

/**
 * List all deployments in a namespace
 */
export async function listDeployments(
  namespace?: string
): Promise<DeploymentInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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
  } catch (error) {
    throw new Error(`Failed to list deployments: ${handleK8sError(error)}`);
  }
}

/**
 * Get details of a specific deployment
 */
export async function getDeployment(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const appsApi = k8sClient.getAppsApi();
    const response = await appsApi.readNamespacedDeployment({
      name,
      namespace: ns,
    });
    return response;
  } catch (error) {
    throw new Error(
      `Failed to get deployment '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Scale a deployment
 */
export async function scaleDeployment(
  name: string,
  replicas: number,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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

    return `Deployment '${name}' scaled to ${replicas} replicas`;
  } catch (error) {
    throw new Error(
      `Failed to scale deployment '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Restart a deployment (by updating annotation)
 */
export async function restartDeployment(
  name: string,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const appsApi = k8sClient.getAppsApi();
    const deployment = await appsApi.readNamespacedDeployment({
      name,
      namespace: ns,
    });

    // Add restart annotation to trigger rolling restart
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

    return `Deployment '${name}' restart initiated`;
  } catch (error) {
    throw new Error(
      `Failed to restart deployment '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Get deployment rollout status
 */
export async function getDeploymentStatus(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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
      replicas: {
        desired: replicas,
        ready,
        upToDate,
        available,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions: conditions.map((c: any) => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
        lastUpdateTime: c.lastUpdateTime,
      })),
    };
  } catch (error) {
    throw new Error(
      `Failed to get deployment status for '${name}': ${handleK8sError(error)}`
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
