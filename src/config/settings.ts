import type { ServerConfig } from '../types/index.js';

/**
 * Load server configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  return {
    configSource:
      (process.env.KUBEMCP_CONFIG_SOURCE as 'local' | 'multipass') || 'local',
    vmName: process.env.KUBEMCP_VM_NAME || 'microk8s-vm',
    defaultNamespace: process.env.KUBEMCP_DEFAULT_NAMESPACE || 'default',
    logLevel:
      (process.env.KUBEMCP_LOG_LEVEL as ServerConfig['logLevel']) || 'info',
  };
}

/**
 * Get the current server configuration
 */
export const config = loadConfig();
