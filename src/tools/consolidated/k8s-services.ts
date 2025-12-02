/**
 * Consolidated Kubernetes Services Tool
 * Combines: list, get, get_endpoints
 */

import { z } from 'zod';
import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../../utils/k8s-client.js';
import { config } from '../../config/settings.js';
import type { ServiceInfo } from '../../types/index.js';

// Input schema for the consolidated tool
export const ServicesInputSchema = z.object({
  action: z
    .enum(['list', 'get', 'get_endpoints'])
    .describe('Action to perform'),
  name: z
    .string()
    .optional()
    .describe('Service name (required for get and get_endpoints)'),
  namespace: z.string().optional().describe('Namespace (optional)'),
});

export type ServicesInput = z.infer<typeof ServicesInputSchema>;

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
 * List all services in a namespace
 */
async function listServices(namespace?: string): Promise<ServiceInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.listNamespacedService({ namespace: ns });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.items.map((service: any) => {
    const ports =
      service.spec?.ports
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.map((p: any) => {
          const protocol = p.protocol || 'TCP';
          const targetPort = p.targetPort ? `:${p.targetPort}` : '';
          return `${p.port}${targetPort}/${protocol}`;
        })
        .join(', ') || 'none';

    const externalIP =
      service.status?.loadBalancer?.ingress?.[0]?.ip ||
      service.spec?.externalIPs?.[0] ||
      (service.spec?.type === 'NodePort' ? '<nodes>' : undefined);

    const age = calculateAge(service.metadata?.creationTimestamp);

    return {
      name: service.metadata?.name || 'unknown',
      namespace: service.metadata?.namespace || ns,
      type: service.spec?.type || 'ClusterIP',
      clusterIP: service.spec?.clusterIP || 'None',
      externalIP,
      ports,
      age,
    };
  });
}

/**
 * Get details of a specific service
 */
async function getService(name: string, namespace?: string): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.readNamespacedService({ name, namespace: ns });
  return response;
}

/**
 * Get service endpoints
 */
async function getServiceEndpoints(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  const coreApi = k8sClient.getCoreApi();
  const response = await coreApi.readNamespacedEndpoints({
    name,
    namespace: ns,
  });
  const endpoints = response;

  const endpointList =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    endpoints.subsets?.flatMap((subset: any) => {
      const addresses = subset.addresses || [];
      const ports = subset.ports || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return addresses.flatMap((addr: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ports.map((port: any) => ({
          ip: addr.ip,
          hostname: addr.hostname,
          nodeName: addr.nodeName,
          targetRef: addr.targetRef,
          port: port.port,
          protocol: port.protocol,
          name: port.name,
        }))
      );
    }) || [];

  return {
    name: endpoints.metadata?.name,
    namespace: endpoints.metadata?.namespace,
    endpoints: endpointList,
  };
}

/**
 * Handle the consolidated services tool
 */
export async function handleServices(params: ServicesInput): Promise<unknown> {
  const { action, name, namespace } = params;

  try {
    switch (action) {
      case 'list':
        return await listServices(namespace);

      case 'get':
        if (!name) throw new Error('name is required for get action');
        return await getService(name, namespace);

      case 'get_endpoints':
        if (!name) throw new Error('name is required for get_endpoints action');
        return await getServiceEndpoints(name, namespace);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw new Error(`Failed to ${action} service: ${handleK8sError(error)}`);
  }
}

/**
 * Tool definition for MCP
 */
export const servicesToolDefinition = {
  name: 'k8s_services',
  description: `Manage Kubernetes services. Actions:
- list: List all services in a namespace
- get: Get service details
- get_endpoints: Get endpoints for a service`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'get_endpoints'],
        description: 'Action to perform',
      },
      name: {
        type: 'string',
        description: 'Service name (required for get and get_endpoints)',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (optional)',
      },
    },
    required: ['action'],
  },
};
