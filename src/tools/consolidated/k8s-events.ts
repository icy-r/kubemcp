/**
 * Consolidated Kubernetes Events Tool
 * Combines: list, get_resource, get_recent
 */

import { z } from 'zod';
import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../../utils/k8s-client.js';
import { config } from '../../config/settings.js';
import type { EventInfo } from '../../types/index.js';

// Input schema for the consolidated tool
export const EventsInputSchema = z.object({
  action: z
    .enum(['list', 'get_resource', 'get_recent'])
    .describe('Action to perform'),
  namespace: z.string().optional().describe('Namespace (optional)'),
  kind: z
    .string()
    .optional()
    .describe(
      'Resource kind (e.g., Pod, Deployment) - required for get_resource'
    ),
  name: z
    .string()
    .optional()
    .describe('Resource name - required for get_resource'),
  fieldSelector: z
    .string()
    .optional()
    .describe('Field selector for filtering (optional)'),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of events to return (default: 50)'),
});

export type EventsInput = z.infer<typeof EventsInputSchema>;

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp?: Date | string): string {
  if (!timestamp) return 'unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

/**
 * Get cluster events
 */
async function getEvents(
  namespace?: string,
  fieldSelector?: string,
  limit?: number
): Promise<EventInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.listNamespacedEvent({
    namespace: ns,
    fieldSelector,
    limit,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.items.map((event: any) => {
    const obj = event.involvedObject;
    const objectName = `${obj.kind}/${obj.name}`;
    const lastSeen = formatTimestamp(event.lastTimestamp);

    return {
      namespace: event.metadata?.namespace || ns,
      lastSeen,
      type: event.type || 'Normal',
      reason: event.reason || 'Unknown',
      object: objectName,
      message: event.message || 'No message',
    };
  });
}

/**
 * Get events for a specific resource
 */
async function getResourceEvents(
  kind: string,
  name: string,
  namespace?: string
): Promise<EventInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const fieldSelector = `involvedObject.kind=${kind},involvedObject.name=${name}`;
  return await getEvents(ns, fieldSelector);
}

/**
 * Get recent events (sorted by timestamp)
 */
async function getRecentEvents(
  namespace?: string,
  limit: number = 50
): Promise<EventInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const events = await getEvents(ns, undefined, limit);

  // Sort by last timestamp, most recent first
  return events.sort((a, b) => {
    const timeA = new Date(a.lastSeen).getTime();
    const timeB = new Date(b.lastSeen).getTime();
    return timeB - timeA;
  });
}

/**
 * Handle the consolidated events tool
 */
export async function handleEvents(params: EventsInput): Promise<unknown> {
  const { action, namespace, kind, name, fieldSelector, limit } = params;

  try {
    switch (action) {
      case 'list':
        return await getEvents(namespace, fieldSelector, limit);

      case 'get_resource':
        if (!kind) throw new Error('kind is required for get_resource action');
        if (!name) throw new Error('name is required for get_resource action');
        return await getResourceEvents(kind, name, namespace);

      case 'get_recent':
        return await getRecentEvents(namespace, limit);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw new Error(`Failed to ${action} events: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const eventsToolDefinition = {
  name: 'k8s_events',
  description: `Get Kubernetes cluster events. Actions:
- list: Get cluster events with optional filtering
- get_resource: Get events for a specific resource
- get_recent: Get recent events sorted by timestamp`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get_resource', 'get_recent'],
        description: 'Action to perform',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (optional)',
      },
      kind: {
        type: 'string',
        description:
          'Resource kind (e.g., Pod, Deployment) - required for get_resource',
      },
      name: {
        type: 'string',
        description: 'Resource name - required for get_resource',
      },
      fieldSelector: {
        type: 'string',
        description: 'Field selector for filtering (optional)',
      },
      limit: {
        type: 'number',
        default: 50,
        description: 'Maximum number of events to return (default: 50)',
      },
    },
    required: ['action'],
  },
};
