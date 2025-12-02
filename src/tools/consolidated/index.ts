/**
 * Consolidated Kubernetes Tools
 * Exports all consolidated tools and their definitions
 */

// Tool handlers
export {
  handleDeployments,
  deploymentsToolDefinition,
  type DeploymentsInput,
} from './k8s-deployments.js';
export { handlePods, podsToolDefinition, type PodsInput } from './k8s-pods.js';
export {
  handleServices,
  servicesToolDefinition,
  type ServicesInput,
} from './k8s-services.js';
export {
  handleConfigMaps,
  configMapsToolDefinition,
  type ConfigMapsInput,
} from './k8s-configmaps.js';
export {
  handleSecrets,
  secretsToolDefinition,
  type SecretsInput,
} from './k8s-secrets.js';
export {
  handleNamespaces,
  namespacesToolDefinition,
  type NamespacesInput,
} from './k8s-namespaces.js';
export {
  handleMetrics,
  metricsToolDefinition,
  type MetricsInput,
} from './k8s-metrics.js';
export {
  handleEvents,
  eventsToolDefinition,
  type EventsInput,
} from './k8s-events.js';
export {
  handleAudit,
  auditToolDefinition,
  type AuditInput,
} from './k8s-audit.js';

// All tool definitions for registration
export const allToolDefinitions = [
  deploymentsToolDefinition,
  podsToolDefinition,
  servicesToolDefinition,
  configMapsToolDefinition,
  secretsToolDefinition,
  namespacesToolDefinition,
  metricsToolDefinition,
  eventsToolDefinition,
  auditToolDefinition,
];

// Import tool definitions for re-export
import { deploymentsToolDefinition } from './k8s-deployments.js';
import { podsToolDefinition } from './k8s-pods.js';
import { servicesToolDefinition } from './k8s-services.js';
import { configMapsToolDefinition } from './k8s-configmaps.js';
import { secretsToolDefinition } from './k8s-secrets.js';
import { namespacesToolDefinition } from './k8s-namespaces.js';
import { metricsToolDefinition } from './k8s-metrics.js';
import { eventsToolDefinition } from './k8s-events.js';
import { auditToolDefinition } from './k8s-audit.js';
