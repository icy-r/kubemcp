import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import type { NamespaceInfo } from '../types/index.js';
import * as k8s from '@kubernetes/client-node';

/**
 * List all namespaces
 */
export async function listNamespaces(): Promise<NamespaceInfo[]> {
  await ensureInitialized();

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.listNamespace();

    return response.items.map((ns: k8s.V1Namespace) => {
      const age = calculateAge(ns.metadata?.creationTimestamp);

      return {
        name: ns.metadata?.name || 'unknown',
        status: ns.status?.phase || 'Unknown',
        age,
      };
    });
  } catch (error) {
    throw new Error(`Failed to list namespaces: ${handleK8sError(error)}`);
  }
}

/**
 * Create a namespace
 */
export async function createNamespace(name: string): Promise<string> {
  await ensureInitialized();

  try {
    const coreApi = k8sClient.getCoreApi();
    const namespace: k8s.V1Namespace = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name,
      },
    };

    await coreApi.createNamespace({ body: namespace });
    return `Namespace '${name}' created successfully`;
  } catch (error) {
    throw new Error(
      `Failed to create namespace '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Delete a namespace
 */
export async function deleteNamespace(name: string): Promise<string> {
  await ensureInitialized();

  try {
    const coreApi = k8sClient.getCoreApi();
    await coreApi.deleteNamespace({ name });
    return `Namespace '${name}' deletion initiated`;
  } catch (error) {
    throw new Error(
      `Failed to delete namespace '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Get details of a specific namespace
 */
export async function getNamespace(name: string): Promise<object> {
  await ensureInitialized();

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.readNamespace({ name });
    return response;
  } catch (error) {
    throw new Error(
      `Failed to get namespace '${name}': ${handleK8sError(error)}`
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
