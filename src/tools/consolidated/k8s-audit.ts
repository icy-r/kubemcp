/**
 * Kubernetes Audit Tool
 * Provides audit logging controls, dry-run mode, and operation history
 * Addresses GitHub issues #3, #4, #5, #6
 */

import { z } from 'zod';
import {
  setDryRunMode,
  isDryRunMode,
  configureAudit,
  getAuditConfig,
  getSessionLog,
  clearSessionLog,
  getSessionStats,
} from '../../utils/audit.js';

// Input schema for the audit tool
export const AuditInputSchema = z.object({
  action: z
    .enum([
      'get_status',
      'set_dry_run',
      'get_session_log',
      'get_stats',
      'clear_session',
      'configure',
    ])
    .describe('Action to perform'),
  enabled: z
    .boolean()
    .optional()
    .describe('Enable/disable dry-run mode (for set_dry_run action)'),
  requireConfirmation: z
    .boolean()
    .optional()
    .describe('Require confirmation for destructive actions (for configure)'),
  logToConsole: z
    .boolean()
    .optional()
    .describe('Log audit entries to console (for configure)'),
});

export type AuditInput = z.infer<typeof AuditInputSchema>;

/**
 * Get current audit status
 */
function getStatus(): object {
  const config = getAuditConfig();
  const stats = getSessionStats();

  return {
    dryRunMode: isDryRunMode(),
    config,
    sessionStats: stats,
  };
}

/**
 * Handle the audit tool
 */
export async function handleAudit(params: AuditInput): Promise<unknown> {
  const { action, enabled, requireConfirmation, logToConsole } = params;

  switch (action) {
    case 'get_status':
      return getStatus();

    case 'set_dry_run':
      if (enabled === undefined) {
        throw new Error('enabled is required for set_dry_run action');
      }
      setDryRunMode(enabled);
      return {
        message: `Dry-run mode ${enabled ? 'enabled' : 'disabled'}`,
        dryRunMode: enabled,
      };

    case 'get_session_log':
      return {
        entries: getSessionLog(),
        count: getSessionLog().length,
      };

    case 'get_stats':
      return getSessionStats();

    case 'clear_session':
      clearSessionLog();
      return { message: 'Session audit log cleared' };

    case 'configure': {
      const updates: Record<string, unknown> = {};
      if (requireConfirmation !== undefined) {
        updates.requireConfirmation = requireConfirmation;
      }
      if (logToConsole !== undefined) {
        updates.logToConsole = logToConsole;
      }
      configureAudit(updates);
      return {
        message: 'Audit configuration updated',
        config: getAuditConfig(),
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Tool definition for MCP
 */
export const auditToolDefinition = {
  name: 'k8s_audit',
  description: `Manage audit logging and safety controls. Actions:
- get_status: Check dry-run mode and session stats
- set_dry_run: Enable/disable dry-run mode globally
- get_session_log: View changes made in this session
- get_stats: Get statistics about operations in this session
- clear_session: Clear session audit log
- configure: Update audit settings (requireConfirmation, logToConsole)`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'get_status',
          'set_dry_run',
          'get_session_log',
          'get_stats',
          'clear_session',
          'configure',
        ],
        description: 'Action to perform',
      },
      enabled: {
        type: 'boolean',
        description: 'Enable/disable dry-run mode (for set_dry_run action)',
      },
      requireConfirmation: {
        type: 'boolean',
        description:
          'Require confirmation for destructive actions (for configure)',
      },
      logToConsole: {
        type: 'boolean',
        description: 'Log audit entries to console (for configure)',
      },
    },
    required: ['action'],
  },
};
