/**
 * Type definitions for KubeMCP
 */

export interface ServerConfig {
  configSource: 'local' | 'multipass' | 'custom';
  customKubeconfigPath?: string;
  vmName: string;
  defaultNamespace: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  responseFormat: 'json' | 'toon' | 'auto';
  logMaxLines: number;
  logMaxBytes: number;
  logDefaultSeverity?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
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

/**
 * Log filtering options
 */
export interface LogFilterOptions {
  severityFilter?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
  grep?: string;
  maxBytes?: number;
  maxLines?: number;
}

/**
 * Log summary statistics
 */
export interface LogSummary {
  totalLines: number;
  estimatedBytes: number;
  timeRange: {
    earliest?: string;
    latest?: string;
  };
  severityCounts: {
    ERROR: number;
    WARN: number;
    INFO: number;
    DEBUG: number;
    TRACE: number;
    UNKNOWN: number;
  };
  topErrors: Array<{
    pattern: string;
    count: number;
    sample: string;
  }>;
  recentErrors: string[];
}
