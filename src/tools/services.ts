import {
  k8sClient,
  handleK8sError,
  ensureInitialized,
} from '../utils/k8s-client.js';
import { config } from '../config/settings.js';
import type { ServiceInfo } from '../types/index.js';

/**
 * List all services in a namespace
 */
export async function listServices(namespace?: string): Promise<ServiceInfo[]> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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
  } catch (error) {
    throw new Error(`Failed to list services: ${handleK8sError(error)}`);
  }
}

/**
 * Get details of a specific service
 */
export async function getService(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
    const coreApi = k8sClient.getCoreApi();
    const response = await coreApi.readNamespacedService({
      name,
      namespace: ns,
    });
    return response;
  } catch (error) {
    throw new Error(
      `Failed to get service '${name}': ${handleK8sError(error)}`
    );
  }
}

/**
 * Get service endpoints
 */
export async function getServiceEndpoints(
  name: string,
  namespace?: string
): Promise<object> {
  await ensureInitialized();
  const ns = namespace || config.defaultNamespace;

  try {
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
  } catch (error) {
    throw new Error(
      `Failed to get endpoints for service '${name}': ${handleK8sError(error)}`
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
