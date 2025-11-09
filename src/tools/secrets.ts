import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import type { SecretInfo } from '../types/index.js';
import * as k8s from '@kubernetes/client-node';

/**
 * List all Secrets in a namespace
 */
export async function listSecrets(namespace?: string): Promise<SecretInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.listNamespacedSecret({ namespace: ns });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.items.map((secret: any) => {
      const dataKeys = Object.keys(secret.data || {});
      const age = calculateAge(secret.metadata?.creationTimestamp);

      return {
        name: secret.metadata?.name || 'unknown',
        namespace: secret.metadata?.namespace || ns,
        type: secret.type || 'Opaque',
        dataKeys,
        age,
      };
    });
  } catch (error) {
    throw new Error(`Failed to list Secrets: ${handleK8sError(error)}`);
  }
}

/**
 * Get a specific Secret (without decoding data for security)
 */
export async function getSecret(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.readNamespacedSecret({
      name,
      namespace: ns,
    });

    // Return metadata and keys only, not the actual secret data
    return {
      metadata: response.metadata,
      type: response.type,
      dataKeys: Object.keys(response.data || {}),
    };
  } catch (error) {
    throw new Error(`Failed to get Secret '${name}': ${handleK8sError(error)}`);
  }
}

/**
 * Create a Secret
 */
export async function createSecret(
  name: string,
  data: Record<string, string>,
  type: string = 'Opaque',
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();

    // Encode data to base64
    const encodedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64');
    }

    const secret: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        namespace: ns,
      },
      type,
      data: encodedData,
    };

    await coreApi.createNamespacedSecret({ namespace: ns, body: secret });
    return `Secret '${name}' created successfully`;
  } catch (error) {
    throw new Error(
      `Failed to create Secret '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Update a Secret
 */
export async function updateSecret(
  name: string,
  data: Record<string, string>,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const existing = await coreApi.readNamespacedSecret({
      name,
      namespace: ns,
    });

    // Encode data to base64
    const encodedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64');
    }

    existing.data = encodedData;

    await coreApi.replaceNamespacedSecret({
      name,
      namespace: ns,
      body: existing,
    });
    return `Secret '${name}' updated successfully`;
  } catch (error) {
    throw new Error(
      `Failed to update Secret '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Delete a Secret
 */
export async function deleteSecret(
  name: string,
  namespace?: string
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    await coreApi.deleteNamespacedSecret({ name, namespace: ns });
    return `Secret '${name}' deleted successfully`;
  } catch (error) {
    throw new Error(
      `Failed to delete Secret '${name}': ${handleK8sError(error)}`
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
