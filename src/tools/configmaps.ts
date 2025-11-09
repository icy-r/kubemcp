import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import type { ConfigMapInfo } from '../types/index.js';
import * as k8s from '@kubernetes/client-node';

/**
 * List all ConfigMaps in a namespace
 */
export async function listConfigMaps(
  namespace?: string
): Promise<ConfigMapInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.listNamespacedConfigMap({ namespace: ns });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.items.map((cm: any) => {
      const dataKeys = Object.keys(cm.data || {});
      const age = calculateAge(cm.metadata?.creationTimestamp);

      return {
        name: cm.metadata?.name || 'unknown',
        namespace: cm.metadata?.namespace || ns,
        dataKeys,
        age,
      };
    });
  } catch (error) {
    throw new Error(`Failed to list ConfigMaps: ${handleK8sError(error)}`);
  }
}

/**
 * Get a specific ConfigMap
 */
export async function getConfigMap(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.readNamespacedConfigMap({
      name,
      namespace: ns,
    });
    return response;
  } catch (error) {
    throw new Error(
      `Failed to get ConfigMap '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Create a ConfigMap
 */
export async function createConfigMap(
  name: string,
  data: Record<string, string>,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const configMap: k8s.V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name,
        namespace: ns,
      },
      data,
    };

    await coreApi.createNamespacedConfigMap({ namespace: ns, body: configMap });
    return `ConfigMap '${name}' created successfully`;
  } catch (error) {
    throw new Error(
      `Failed to create ConfigMap '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Update a ConfigMap
 */
export async function updateConfigMap(
  name: string,
  data: Record<string, string>,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const existing = await coreApi.readNamespacedConfigMap({
      name,
      namespace: ns,
    });

    existing.data = data;

    await coreApi.replaceNamespacedConfigMap({
      name,
      namespace: ns,
      body: existing,
    });
    return `ConfigMap '${name}' updated successfully`;
  } catch (error) {
    throw new Error(
      `Failed to update ConfigMap '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Delete a ConfigMap
 */
export async function deleteConfigMap(
  name: string,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    await coreApi.deleteNamespacedConfigMap({ name, namespace: ns });
    return `ConfigMap '${name}' deleted successfully`;
  } catch (error) {
    throw new Error(
      `Failed to delete ConfigMap '${name}': ${handleK8sError(error)}`
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
