/**
 * Audit logging, dry-run mode, and confirmation safeguards for Kubernetes operations
 * Addresses GitHub issues #3, #4, #5, #6
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'scale'
  | 'restart'
  | 'get'
  | 'list';

export interface AuditEntry {
  timestamp: string;
  action: AuditAction;
  resource: string;
  name: string;
  namespace?: string;
  input: Record<string, unknown>;
  result: 'success' | 'failure' | 'dry-run';
  error?: string;
  dryRun: boolean;
}

export interface AuditConfig {
  enabled: boolean;
  logToConsole: boolean;
  requireConfirmation: boolean;
  confirmationRequired: AuditAction[];
}

// Session-based audit log (in-memory for current session)
const sessionLog: AuditEntry[] = [];

// Global dry-run mode
let dryRunMode = false;

// Audit configuration
let auditConfig: AuditConfig = {
  enabled: true,
  logToConsole: false,
  requireConfirmation: true,
  confirmationRequired: ['delete', 'update', 'scale'],
};

/**
 * Enable or disable dry-run mode globally
 */
export function setDryRunMode(enabled: boolean): void {
  dryRunMode = enabled;
  logToStderr(`Dry-run mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if dry-run mode is enabled
 */
export function isDryRunMode(): boolean {
  return dryRunMode;
}

/**
 * Configure audit settings
 */
export function configureAudit(config: Partial<AuditConfig>): void {
  auditConfig = { ...auditConfig, ...config };
  logToStderr(`Audit configuration updated`);
}

/**
 * Get current audit configuration
 */
export function getAuditConfig(): AuditConfig {
  return { ...auditConfig };
}

/**
 * Log an audit entry
 */
export function logAudit(entry: Omit<AuditEntry, 'timestamp'>): void {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  sessionLog.push(fullEntry);

  if (auditConfig.logToConsole) {
    logToStderr(
      `[AUDIT] ${fullEntry.action.toUpperCase()} ${fullEntry.resource}/${fullEntry.name} - ${fullEntry.result}`
    );
  }
}

/**
 * Get the session audit log
 */
export function getSessionLog(): AuditEntry[] {
  return [...sessionLog];
}

/**
 * Clear the session audit log
 */
export function clearSessionLog(): void {
  sessionLog.length = 0;
  logToStderr('Session audit log cleared');
}

/**
 * Get audit statistics for the current session
 */
export function getSessionStats(): {
  total: number;
  success: number;
  failure: number;
  dryRun: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
} {
  const stats = {
    total: sessionLog.length,
    success: 0,
    failure: 0,
    dryRun: 0,
    byAction: {} as Record<string, number>,
    byResource: {} as Record<string, number>,
  };

  for (const entry of sessionLog) {
    if (entry.result === 'success') stats.success++;
    else if (entry.result === 'failure') stats.failure++;
    else if (entry.result === 'dry-run') stats.dryRun++;

    stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
    stats.byResource[entry.resource] =
      (stats.byResource[entry.resource] || 0) + 1;
  }

  return stats;
}

/**
 * Check if confirmation is required for an action
 */
export function requiresConfirmation(action: AuditAction): boolean {
  return (
    auditConfig.requireConfirmation &&
    auditConfig.confirmationRequired.includes(action)
  );
}

/**
 * Validate that confirmation was provided for destructive actions
 */
export function validateConfirmation(
  action: AuditAction,
  confirmed: boolean | undefined,
  dryRun: boolean | undefined
): { valid: boolean; error?: string } {
  // Dry-run mode bypasses confirmation
  if (dryRun || dryRunMode) {
    return { valid: true };
  }

  // Check if confirmation is required
  if (requiresConfirmation(action) && !confirmed) {
    return {
      valid: false,
      error: `Action '${action}' requires confirmation. Set confirm=true to proceed, or use dryRun=true to preview changes.`,
    };
  }

  return { valid: true };
}

/**
 * Create a dry-run summary for an operation
 */
export function createDryRunSummary(
  action: AuditAction,
  resource: string,
  name: string,
  namespace: string | undefined,
  changes: Record<string, unknown>
): string {
  const lines = [
    '═══════════════════════════════════════════════════════════',
    '  🔍 DRY-RUN MODE - No changes will be made',
    '═══════════════════════════════════════════════════════════',
    '',
    `  Action:   ${action.toUpperCase()}`,
    `  Resource: ${resource}`,
    `  Target:   ${namespace ? `${namespace}/${name}` : name}`,
    '',
    '  Proposed Changes:',
  ];

  for (const [key, value] of Object.entries(changes)) {
    const displayValue =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    const truncated =
      displayValue.length > 50
        ? displayValue.substring(0, 50) + '...'
        : displayValue;
    lines.push(`    • ${key}: ${truncated}`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Log to stderr (for MCP servers)
 */
function logToStderr(message: string): void {
  console.error(`[${new Date().toISOString()}] [kube-mcp:audit] ${message}`);
}
