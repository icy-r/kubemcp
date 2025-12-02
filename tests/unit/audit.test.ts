import { describe, it, expect, beforeEach } from 'vitest';
import {
  setDryRunMode,
  isDryRunMode,
  configureAudit,
  getAuditConfig,
  logAudit,
  getSessionLog,
  clearSessionLog,
  getSessionStats,
  validateConfirmation,
  createDryRunSummary,
} from '../../src/utils/audit.js';

describe('Audit Module', () => {
  beforeEach(() => {
    clearSessionLog();
    setDryRunMode(false);
    configureAudit({
      enabled: true,
      logToConsole: false,
      requireConfirmation: true,
      confirmationRequired: ['delete', 'update', 'scale'],
    });
  });

  describe('Dry-run mode', () => {
    it('should be disabled by default', () => {
      expect(isDryRunMode()).toBe(false);
    });

    it('should enable dry-run mode', () => {
      setDryRunMode(true);
      expect(isDryRunMode()).toBe(true);
    });

    it('should disable dry-run mode', () => {
      setDryRunMode(true);
      setDryRunMode(false);
      expect(isDryRunMode()).toBe(false);
    });
  });

  describe('Audit configuration', () => {
    it('should get default config', () => {
      const config = getAuditConfig();
      expect(config.enabled).toBe(true);
      expect(config.requireConfirmation).toBe(true);
    });

    it('should update config partially', () => {
      configureAudit({ logToConsole: true });
      const config = getAuditConfig();
      expect(config.logToConsole).toBe(true);
      expect(config.enabled).toBe(true);
    });
  });

  describe('Audit logging', () => {
    it('should log an audit entry', () => {
      logAudit({
        action: 'create',
        resource: 'deployment',
        name: 'test-deployment',
        namespace: 'default',
        input: { replicas: 3 },
        result: 'success',
        dryRun: false,
      });

      const log = getSessionLog();
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe('create');
      expect(log[0].resource).toBe('deployment');
      expect(log[0].name).toBe('test-deployment');
    });

    it('should clear session log', () => {
      logAudit({
        action: 'delete',
        resource: 'pod',
        name: 'test-pod',
        input: {},
        result: 'success',
        dryRun: false,
      });

      clearSessionLog();
      expect(getSessionLog()).toHaveLength(0);
    });
  });

  describe('Session statistics', () => {
    it('should calculate stats correctly', () => {
      logAudit({
        action: 'create',
        resource: 'deployment',
        name: 'deploy-1',
        input: {},
        result: 'success',
        dryRun: false,
      });

      logAudit({
        action: 'delete',
        resource: 'pod',
        name: 'pod-1',
        input: {},
        result: 'failure',
        error: 'Not found',
        dryRun: false,
      });

      logAudit({
        action: 'scale',
        resource: 'deployment',
        name: 'deploy-2',
        input: { replicas: 5 },
        result: 'dry-run',
        dryRun: true,
      });

      const stats = getSessionStats();
      expect(stats.total).toBe(3);
      expect(stats.success).toBe(1);
      expect(stats.failure).toBe(1);
      expect(stats.dryRun).toBe(1);
      expect(stats.byAction['create']).toBe(1);
      expect(stats.byAction['delete']).toBe(1);
      expect(stats.byAction['scale']).toBe(1);
      expect(stats.byResource['deployment']).toBe(2);
      expect(stats.byResource['pod']).toBe(1);
    });
  });

  describe('Confirmation validation', () => {
    it('should require confirmation for delete', () => {
      const result = validateConfirmation('delete', false, false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('requires confirmation');
    });

    it('should pass when confirmed', () => {
      const result = validateConfirmation('delete', true, false);
      expect(result.valid).toBe(true);
    });

    it('should bypass confirmation in dry-run mode', () => {
      const result = validateConfirmation('delete', false, true);
      expect(result.valid).toBe(true);
    });

    it('should not require confirmation for list', () => {
      const result = validateConfirmation('list', false, false);
      expect(result.valid).toBe(true);
    });
  });

  describe('Dry-run summary', () => {
    it('should create dry-run summary', () => {
      const summary = createDryRunSummary(
        'scale',
        'deployment',
        'my-app',
        'production',
        { replicas: 5 }
      );

      expect(summary).toContain('DRY-RUN MODE');
      expect(summary).toContain('SCALE');
      expect(summary).toContain('deployment');
      expect(summary).toContain('my-app');
      expect(summary).toContain('replicas');
    });
  });
});

