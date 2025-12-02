/**
 * Consolidated Kubernetes Secrets Tool
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
import type { SecretInfo } from '../../types/index.js';

// Input schema for the consolidated tool
export const SecretsInputSchema = z.object({
  action: z
    .enum(['list', 'get', 'create', 'update', 'delete'])
    .describe('Action to perform'),
  name: z
    .string()
    .optional()
    .describe('Secret name (required for most actions except list)'),
  namespace: z.string().optional().describe('Namespace (optional)'),
  data: z
    .record(z.string())
    .optional()
    .describe('Secret data as key-value pairs (required for create/update)'),
  type: z
    .string()
    .optional()
    .default('Opaque')
    .describe('Secret type (default: Opaque)'),
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

export type SecretsInput = z.infer<typeof SecretsInputSchema>;

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
 * List all Secrets in a namespace
 */
async function listSecrets(namespace?: string): Promise<SecretInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

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
}

/**
 * Get a specific Secret (metadata only, no data for security)
 */
async function getSecret(name: string, namespace?: string): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.readNamespacedSecret({ name, namespace: ns });

  // Return metadata and keys only, not the actual secret data
  return {
    metadata: response.metadata,
    type: response.type,
    dataKeys: Object.keys(response.data || {}),
  };
}

/**
 * Create a Secret
 */
async function createSecret(
  name: string,
  data: Record<string, string>,
  type: string,
  namespace?: string,
  dryRun?: boolean
): Promise<string> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  // Check dry-run mode
  if (dryRun || isDryRunMode()) {
    logAudit({
      action: 'create',
      resource: 'secret',
      name,
      namespace: ns,
      input: { type, keys: Object.keys(data) },
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('create', 'secret', name, ns, {
      type,
      keys: Object.keys(data),
    });
  }

  const coreApi = k8sClient.getCoreApi();

  // Encode data to base64
  const encodedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    encodedData[key] = Buffer.from(value).toString('base64');
  }

  const secret: k8s.V1Secret = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name, namespace: ns },
    type,
    data: encodedData,
  };

  await coreApi.createNamespacedSecret({ namespace: ns, body: secret });

  logAudit({
    action: 'create',
    resource: 'secret',
    name,
    namespace: ns,
    input: { type, keys: Object.keys(data) },
    result: 'success',
    dryRun: false,
  });

  return `Secret '${name}' created successfully`;
}

/**
 * Update a Secret
 */
async function updateSecret(
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
      resource: 'secret',
      name,
      namespace: ns,
      input: { keys: Object.keys(data) },
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('update', 'secret', name, ns, {
      keys: Object.keys(data),
    });
  }

  const coreApi = k8sClient.getCoreApi();
  const existing = await coreApi.readNamespacedSecret({ name, namespace: ns });

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

  logAudit({
    action: 'update',
    resource: 'secret',
    name,
    namespace: ns,
    input: { keys: Object.keys(data) },
    result: 'success',
    dryRun: false,
  });

  return `Secret '${name}' updated successfully`;
}

/**
 * Delete a Secret
 */
async function deleteSecret(
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
      resource: 'secret',
      name,
      namespace: ns,
      input: {},
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('delete', 'secret', name, ns, {});
  }

  const coreApi = k8sClient.getCoreApi();
  await coreApi.deleteNamespacedSecret({ name, namespace: ns });

  logAudit({
    action: 'delete',
    resource: 'secret',
    name,
    namespace: ns,
    input: {},
    result: 'success',
    dryRun: false,
  });

  return `Secret '${name}' deleted successfully`;
}

/**
 * Handle the consolidated secrets tool
 */
export async function handleSecrets(params: SecretsInput): Promise<unknown> {
  const { action, name, namespace, data, type, confirm, dryRun } = params;

  try {
    switch (action) {
      case 'list':
        return await listSecrets(namespace);

      case 'get':
        if (!name) throw new Error('name is required for get action');
        return await getSecret(name, namespace);

      case 'create':
        if (!name) throw new Error('name is required for create action');
        if (!data) throw new Error('data is required for create action');
        return await createSecret(
          name,
          data,
          type || 'Opaque',
          namespace,
          dryRun
        );

      case 'update':
        if (!name) throw new Error('name is required for update action');
        if (!data) throw new Error('data is required for update action');
        return await updateSecret(name, data, namespace, dryRun, confirm);

      case 'delete':
        if (!name) throw new Error('name is required for delete action');
        return await deleteSecret(name, namespace, dryRun, confirm);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logAudit({
      action: action as AuditAction,
      resource: 'secret',
      name: name || 'unknown',
      namespace,
      input: { ...params, data: params.data ? '[REDACTED]' : undefined },
      result: 'failure',
      error: handleK8sError(error),
      dryRun: dryRun || false,
    });
    throw new Error(`Failed to ${action} secret: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const secretsToolDefinition = {
  name: 'k8s_secrets',
  description: `Manage Kubernetes Secrets. Actions:
- list: List all Secrets in a namespace
- get: Get a specific Secret (metadata only, no data)
- create: Create a new Secret
- update: Update an existing Secret (requires confirm=true or dryRun=true)
- delete: Delete a Secret (requires confirm=true or dryRun=true)`,
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
        description: 'Secret name (required for most actions except list)',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (optional)',
      },
      data: {
        type: 'object',
        description:
          'Secret data as key-value pairs (required for create/update)',
      },
      type: {
        type: 'string',
        default: 'Opaque',
        description: 'Secret type (default: Opaque)',
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
