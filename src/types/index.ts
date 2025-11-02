/**
 * Type definitions for KubeMCP
 */

export interface ServerConfig {
  configSource: 'local' | 'multipass';
  vmName: string;
  defaultNamespace: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  ip?: string;
  node?: string;
}

export interface DeploymentInfo {
  name: string;
  namespace: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
  replicas: number;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: string;
  age: string;
}

export interface NamespaceInfo {
  name: string;
  status: string;
  age: string;
}

export interface ResourceMetrics {
  name: string;
  namespace?: string;
  cpu: string;
  memory: string;
}

export interface EventInfo {
  namespace: string;
  lastSeen: string;
  type: string;
  reason: string;
  object: string;
  message: string;
}

export interface ConfigMapInfo {
  name: string;
  namespace: string;
  dataKeys: string[];
  age: string;
}

export interface SecretInfo {
  name: string;
  namespace: string;
  type: string;
  dataKeys: string[];
  age: string;
}
