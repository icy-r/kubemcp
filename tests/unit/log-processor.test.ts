import { describe, it, expect } from 'vitest';
import {
  detectSeverity,
  filterBySeverity,
  grepLogs,
  truncateLogs,
  summarizeLogs,
  processLogs,
} from '../../src/utils/log-processor.js';

describe('Log Processor', () => {
  describe('detectSeverity', () => {
    it('should detect ERROR severity', () => {
      expect(detectSeverity('[ERROR] Something failed')).toBe('ERROR');
      expect(detectSeverity('FATAL: crash')).toBe('ERROR');
    });

    it('should detect WARN severity', () => {
      expect(detectSeverity('[WARN] Something suspicious')).toBe('WARN');
      expect(detectSeverity('WARNING: low memory')).toBe('WARN');
    });

    it('should detect INFO severity', () => {
      expect(detectSeverity('[INFO] Server started')).toBe('INFO');
    });

    it('should detect DEBUG severity', () => {
      expect(detectSeverity('[DEBUG] Variable value: 42')).toBe('DEBUG');
    });

    it('should detect TRACE severity', () => {
      expect(detectSeverity('[TRACE] Entering function')).toBe('TRACE');
    });

    it('should return UNKNOWN for unrecognized lines', () => {
      expect(detectSeverity('Just some random text')).toBe('UNKNOWN');
    });
  });

  describe('filterBySeverity', () => {
    const logs = `[ERROR] Error message
[WARN] Warning message
[INFO] Info message
[DEBUG] Debug message`;

    it('should filter to ERROR only', () => {
      const result = filterBySeverity(logs, 'ERROR');
      expect(result).toContain('ERROR');
      expect(result).not.toContain('WARN');
      expect(result).not.toContain('INFO');
    });

    it('should filter to WARN and above', () => {
      const result = filterBySeverity(logs, 'WARN');
      expect(result).toContain('ERROR');
      expect(result).toContain('WARN');
      expect(result).not.toContain('INFO');
    });

    it('should include all when DEBUG', () => {
      const result = filterBySeverity(logs, 'DEBUG');
      expect(result).toContain('ERROR');
      expect(result).toContain('WARN');
      expect(result).toContain('INFO');
      expect(result).toContain('DEBUG');
    });
  });

  describe('grepLogs', () => {
    const logs = `Line 1: Hello world
Line 2: Error occurred
Line 3: Hello again`;

    it('should filter by pattern', () => {
      const result = grepLogs(logs, 'Hello');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 3');
      expect(result).not.toContain('Line 2');
    });

    it('should be case insensitive', () => {
      const result = grepLogs(logs, 'hello');
      expect(result).toContain('Hello');
    });

    it('should throw on invalid regex', () => {
      expect(() => grepLogs(logs, '[')).toThrow('Invalid grep pattern');
    });
  });

  describe('truncateLogs', () => {
    const logs = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

    it('should truncate by lines', () => {
      const result = truncateLogs(logs, Number.MAX_SAFE_INTEGER, 3);
      expect(result.truncated).toBe(true);
      expect(result.logs.split('\n')).toHaveLength(3);
    });

    it('should truncate by bytes', () => {
      const result = truncateLogs(logs, 10);
      expect(result.truncated).toBe(true);
      expect(Buffer.byteLength(result.logs)).toBeLessThanOrEqual(10);
    });

    it('should not truncate when within limits', () => {
      const result = truncateLogs(logs, 1000, 10);
      expect(result.truncated).toBe(false);
    });
  });

  describe('summarizeLogs', () => {
    const logs = `2024-01-01T10:00:00Z [INFO] Server started
2024-01-01T10:01:00Z [ERROR] Connection failed
2024-01-01T10:02:00Z [ERROR] Connection failed
2024-01-01T10:03:00Z [WARN] Retry attempt`;

    it('should count severities', () => {
      const summary = summarizeLogs(logs);
      expect(summary.severityCounts.ERROR).toBe(2);
      expect(summary.severityCounts.WARN).toBe(1);
      expect(summary.severityCounts.INFO).toBe(1);
    });

    it('should extract time range', () => {
      const summary = summarizeLogs(logs);
      expect(summary.timeRange.earliest).toBeDefined();
      expect(summary.timeRange.latest).toBeDefined();
    });

    it('should identify top errors', () => {
      const summary = summarizeLogs(logs);
      expect(summary.topErrors.length).toBeGreaterThan(0);
    });
  });

  describe('processLogs', () => {
    const logs = `[ERROR] Error 1
[WARN] Warning 1
[INFO] Info 1`;

    it('should apply severity filter', () => {
      const result = processLogs(logs, { severityFilter: 'ERROR' });
      expect(result.logs).toContain('ERROR');
      expect(result.logs).not.toContain('WARN');
    });

    it('should apply grep filter', () => {
      const result = processLogs(logs, { grep: 'Warning' });
      expect(result.logs).toContain('Warning');
      expect(result.logs).not.toContain('Error');
    });

    it('should combine filters', () => {
      const logsWithBoth = `[ERROR] Connection error
[ERROR] Timeout error
[WARN] Connection warning`;
      const result = processLogs(logsWithBoth, {
        severityFilter: 'ERROR',
        grep: 'Connection',
      });
      expect(result.logs).toContain('Connection error');
      expect(result.logs).not.toContain('Timeout');
      expect(result.logs).not.toContain('warning');
    });
  });
});

