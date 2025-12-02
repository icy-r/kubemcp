/**
 * Consolidated Kubernetes ConfigMaps Tool
 * Combines: list, get, create, update, delete
 */

import { z } from 'zod';
import * as k8s from '@kubernetes/client-node';
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
import type { ConfigMapInfo } from '../../types/index.js';

// Input schema for the consolidated tool
export const ConfigMapsInputSchema = z.object({
  action: z
    .enum(['list', 'get', 'create', 'update', 'delete'])
    .describe('Action to perform'),
  name: z
    .string()
    .optional()
    .describe('ConfigMap name (required for most actions except list)'),
  namespace: z.string().optional().describe('Namespace (optional)'),
  data: z
    .record(z.string())
    .optional()
    .describe('ConfigMap data as key-value pairs (required for create/update)'),
  confirm: z
    .boolean()
    .optional()
    .describe(
      'Confirm destructive action (required for update/delete unless dryRun=true)'
    ),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview changes without executing (default: false)'),
});

export type ConfigMapsInput = z.infer<typeof ConfigMapsInputSchema>;

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
 * List all ConfigMaps in a namespace
 */
async function listConfigMaps(namespace?: string): Promise<ConfigMapInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

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
}

/**
 * Get a specific ConfigMap
 */
async function getConfigMap(name: string, namespace?: string): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.readNamespacedConfigMap({
    name,
    namespace: ns,
  });
  return response;
}

/**
 * Create a ConfigMap
 */
async function createConfigMap(
  name: string,
  data: Record<string, string>,
  namespace?: string,
  dryRun?: boolean
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  // Check dry-run mode
  if (dryRun || isDryRunMode()) {
    logAudit({
      action: 'create',
      resource: 'configmap',
      name,
      namespace: ns,
      input: { data },
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('create', 'configmap', name, ns, {
      keys: Object.keys(data),
    });
  }

  const coreApi = k8sClient.getCoreApi();
  const configMap: k8s.V1ConfigMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name, namespace: ns },
    data,
  };

  await coreApi.createNamespacedConfigMap({ namespace: ns, body: configMap });

  logAudit({
    action: 'create',
    resource: 'configmap',
    name,
    namespace: ns,
    input: { keys: Object.keys(data) },
    result: 'success',
    dryRun: false,
  });

  return `ConfigMap '${name}' created successfully`;
}

/**
 * Update a ConfigMap
 */
async function updateConfigMap(
  name: string,
  data: Record<string, string>,
  namespace?: string,
  dryRun?: boolean,
  confirm?: boolean
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  // Validate confirmation
  const validation = validateConfirmation(
    'update' as AuditAction,
    confirm,
    dryRun
  );
  if (!validation.valid) {
    return validation.error!;
  }

  // Check dry-run mode
  if (dryRun || isDryRunMode()) {
    logAudit({
      action: 'update',
      resource: 'configmap',
      name,
      namespace: ns,
      input: { data },
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('update', 'configmap', name, ns, {
      keys: Object.keys(data),
    });
  }

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

  logAudit({
    action: 'update',
    resource: 'configmap',
    name,
    namespace: ns,
    input: { keys: Object.keys(data) },
    result: 'success',
    dryRun: false,
  });

  return `ConfigMap '${name}' updated successfully`;
}

/**
 * Delete a ConfigMap
 */
async function deleteConfigMap(
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
      resource: 'configmap',
      name,
      namespace: ns,
      input: {},
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('delete', 'configmap', name, ns, {});
  }

  const coreApi = k8sClient.getCoreApi();
  await coreApi.deleteNamespacedConfigMap({ name, namespace: ns });

  logAudit({
    action: 'delete',
    resource: 'configmap',
    name,
    namespace: ns,
    input: {},
    result: 'success',
    dryRun: false,
  });

  return `ConfigMap '${name}' deleted successfully`;
}

/**
 * Handle the consolidated configmaps tool
 */
export async function handleConfigMaps(
  params: ConfigMapsInput
): Promise<unknown> {
  const { action, name, namespace, data, confirm, dryRun } = params;

  try {
    switch (action) {
      case 'list':
        return await listConfigMaps(namespace);

      case 'get':
        if (!name) throw new Error('name is required for get action');
        return await getConfigMap(name, namespace);

      case 'create':
        if (!name) throw new Error('name is required for create action');
        if (!data) throw new Error('data is required for create action');
        return await createConfigMap(name, data, namespace, dryRun);

      case 'update':
        if (!name) throw new Error('name is required for update action');
        if (!data) throw new Error('data is required for update action');
        return await updateConfigMap(name, data, namespace, dryRun, confirm);

      case 'delete':
        if (!name) throw new Error('name is required for delete action');
        return await deleteConfigMap(name, namespace, dryRun, confirm);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logAudit({
      action: action as AuditAction,
      resource: 'configmap',
      name: name || 'unknown',
      namespace,
      input: params,
      result: 'failure',
      error: handleK8sError(error),
      dryRun: dryRun || false,
    });
    throw new Error(`Failed to ${action} configmap: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const configMapsToolDefinition = {
  name: 'k8s_configmaps',
  description: `Manage Kubernetes ConfigMaps. Actions:
- list: List all ConfigMaps in a namespace
- get: Get a specific ConfigMap
- create: Create a new ConfigMap
- update: Update an existing ConfigMap (requires confirm=true or dryRun=true)
- delete: Delete a ConfigMap (requires confirm=true or dryRun=true)`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'create', 'update', 'delete'],
        description: 'Action to perform',
      },
      name: {
        type: 'string',
        description: 'ConfigMap name (required for most actions except list)',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (optional)',
      },
      data: {
        type: 'object',
        description:
          'ConfigMap data as key-value pairs (required for create/update)',
      },
      confirm: {
        type: 'boolean',
        description:
          'Confirm destructive action (required for update/delete unless dryRun=true)',
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
