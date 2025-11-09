import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import type { EventInfo } from '../types/index.js';

/**
 * Get cluster events
 */
export async function getEvents(
  namespace?: string,
  fieldSelector?: string,
  limit?: number
): Promise<EventInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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
  } catch (error) {
    throw new Error(`Failed to get events: ${handleK8sError(error)}`);
  }
}

/**
 * Get events for a specific resource
 */
export async function getResourceEvents(
  kind: string,
  name: string,
  namespace?: string
): Promise<EventInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const fieldSelector = `involvedObject.kind=${kind},involvedObject.name=${name}`;
    return await getEvents(ns, fieldSelector);
  } catch (error) {
    throw new Error(
      `Failed to get events for ${kind}/${name}: ${handleK8sError(error)}`
    );
  }
}

/**
 * Get events by type (Warning or Normal)
 */
export async function getEventsByType(
  type: 'Warning' | 'Normal',
  namespace?: string,
  limit?: number
): Promise<EventInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const fieldSelector = `type=${type}`;
    return await getEvents(ns, fieldSelector, limit);
  } catch (error) {
    throw new Error(`Failed to get ${type} events: ${handleK8sError(error)}`);
  }
}

/**
 * Get recent events (last N events)
 */
export async function getRecentEvents(
  namespace?: string,
  limit: number = 50
): Promise<EventInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const events = await getEvents(ns, undefined, limit);

    // Sort by last timestamp, most recent first
    return events.sort((a, b) => {
      const timeA = new Date(a.lastSeen).getTime();
      const timeB = new Date(b.lastSeen).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    throw new Error(`Failed to get recent events: ${handleK8sError(error)}`);
  }
}

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
