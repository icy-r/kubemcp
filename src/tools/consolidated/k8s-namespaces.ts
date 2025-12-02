/**
 * Consolidated Kubernetes Namespaces Tool
 * Combines: list, get, create, delete
 */

import { z } from 'zod';
import * as k8s from '@kubernetes/client-node';
import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../../utils/k8s-client.js';
import {
  logAudit,
  isDryRunMode,
  validateConfirmation,
  createDryRunSummary,
  type AuditAction,
} from '../../utils/audit.js';
import type { NamespaceInfo } from '../../types/index.js';

// Input schema for the consolidated tool
export const NamespacesInputSchema = z.object({
  action: z
    .enum(['list', 'get', 'create', 'delete'])
    .describe('Action to perform'),
  name: z
    .string()
    .optional()
    .describe('Namespace name (required for get, create, delete)'),
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

export type NamespacesInput = z.infer<typeof NamespacesInputSchema>;

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
 * List all namespaces
 */
async function listNamespaces(): Promise<NamespaceInfo[]> {
  await ensureInitialized();

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
}

/**
 * Get details of a specific namespace
 */
async function getNamespace(name: string): Promise<object> {
  await ensureInitialized();

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.readNamespace({ name });
  return response;
}

/**
 * Create a namespace
 */
async function createNamespace(
  name: string,
  dryRun?: boolean
): Promise<string> {
  await ensureInitialized();

  // Check dry-run mode
  if (dryRun || isDryRunMode()) {
    logAudit({
      action: 'create',
      resource: 'namespace',
      name,
      input: {},
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('create', 'namespace', name, undefined, {});
  }

  const coreApi = k8sClient.getCoreApi();
  const namespace: k8s.V1Namespace = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name },
  };

  await coreApi.createNamespace({ body: namespace });

  logAudit({
    action: 'create',
    resource: 'namespace',
    name,
    input: {},
    result: 'success',
    dryRun: false,
  });

  return `Namespace '${name}' created successfully`;
}

/**
 * Delete a namespace
 */
async function deleteNamespace(
  name: string,
  dryRun?: boolean,
  confirm?: boolean
): Promise<string> {
  await ensureInitialized();

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
      resource: 'namespace',
      name,
      input: {},
      result: 'dry-run',
      dryRun: true,
    });

    return createDryRunSummary('delete', 'namespace', name, undefined, {});
  }

  const coreApi = k8sClient.getCoreApi();
  await coreApi.deleteNamespace({ name });

  logAudit({
    action: 'delete',
    resource: 'namespace',
    name,
    input: {},
    result: 'success',
    dryRun: false,
  });

  return `Namespace '${name}' deletion initiated`;
}

/**
 * Handle the consolidated namespaces tool
 */
export async function handleNamespaces(
  params: NamespacesInput
): Promise<unknown> {
  const { action, name, confirm, dryRun } = params;

  try {
    switch (action) {
      case 'list':
        return await listNamespaces();

      case 'get':
        if (!name) throw new Error('name is required for get action');
        return await getNamespace(name);

      case 'create':
        if (!name) throw new Error('name is required for create action');
        return await createNamespace(name, dryRun);

      case 'delete':
        if (!name) throw new Error('name is required for delete action');
        return await deleteNamespace(name, dryRun, confirm);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logAudit({
      action: action as AuditAction,
      resource: 'namespace',
      name: name || 'unknown',
      input: params,
      result: 'failure',
      error: handleK8sError(error),
      dryRun: dryRun || false,
    });
    throw new Error(`Failed to ${action} namespace: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const namespacesToolDefinition = {
  name: 'k8s_namespaces',
  description: `Manage Kubernetes namespaces. Actions:
- list: List all namespaces in the cluster
- get: Get details of a specific namespace
- create: Create a new namespace
- delete: Delete a namespace (requires confirm=true or dryRun=true)`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'create', 'delete'],
        description: 'Action to perform',
      },
      name: {
        type: 'string',
        description: 'Namespace name (required for get, create, delete)',
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
