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
    responseFormat:
      (process.env.KUBEMCP_RESPONSE_FORMAT as 'json' | 'toon' | 'auto') ||
      'auto',
    logMaxLines: parseInt(process.env.KUBEMCP_LOG_MAX_LINES || '100', 10),
    logMaxBytes: parseInt(
      process.env.KUBEMCP_LOG_MAX_BYTES || '102400',
      10
    ), // 100KB default
    logDefaultSeverity: process.env.KUBEMCP_LOG_DEFAULT_SEVERITY as
      | 'ERROR'
      | 'WARN'
      | 'INFO'
      | 'DEBUG'
      | 'TRACE'
      | undefined,
  };
}

/**
 * Get the current server configuration
 */
export const config = loadConfig();
