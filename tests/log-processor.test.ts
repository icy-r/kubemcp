import {
  detectSeverity,
  filterBySeverity,
  grepLogs,
  truncateLogs,
  summarizeLogs,
  processLogs,
} from '../src/utils/log-processor';

describe('Log Processor', () => {
  describe('detectSeverity', () => {
    it('should detect ERROR severity', () => {
      expect(detectSeverity('2023-01-01 ERROR Something went wrong')).toBe('ERROR');
      expect(detectSeverity('{"level":"ERROR","msg":"test"}')).toBe('ERROR');
      expect(detectSeverity('FATAL error occurred')).toBe('ERROR');
    });

    it('should detect WARN severity', () => {
      expect(detectSeverity('2023-01-01 WARN Low disk space')).toBe('WARN');
      expect(detectSeverity('WARNING: deprecated API')).toBe('WARN');
      expect(detectSeverity('level=warn msg="test"')).toBe('WARN');
    });

    it('should detect INFO severity', () => {
      expect(detectSeverity('2023-01-01 INFO Application started')).toBe('INFO');
      expect(detectSeverity('{"level":"info","msg":"test"}')).toBe('INFO');
    });

    it('should detect DEBUG severity', () => {
      expect(detectSeverity('2023-01-01 DEBUG Variable value: 42')).toBe('DEBUG');
    });

    it('should return UNKNOWN for unrecognized formats', () => {
      expect(detectSeverity('Just a plain log line')).toBe('UNKNOWN');
    });
  });

  describe('filterBySeverity', () => {
    const logs = `
2023-01-01 ERROR Critical failure
2023-01-01 WARN Low memory
2023-01-01 INFO Server started
2023-01-01 DEBUG Debug info
2023-01-01 TRACE Trace data
    `.trim();

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

    it('should filter to INFO and above', () => {
      const result = filterBySeverity(logs, 'INFO');
      expect(result).toContain('ERROR');
      expect(result).toContain('WARN');
      expect(result).toContain('INFO');
      expect(result).not.toContain('DEBUG');
      expect(result).not.toContain('TRACE');
    });

    it('should include all logs for DEBUG', () => {
      const result = filterBySeverity(logs, 'DEBUG');
      expect(result).toContain('ERROR');
      expect(result).toContain('WARN');
      expect(result).toContain('INFO');
      expect(result).toContain('DEBUG');
    });
  });

  describe('grepLogs', () => {
    const logs = `
Line with error message
Line with warning message
Line with success message
Another error occurred
    `.trim();

    it('should filter lines matching pattern', () => {
      const result = grepLogs(logs, 'error');
      expect(result).toContain('error message');
      expect(result).toContain('error occurred');
      expect(result).not.toContain('warning');
      expect(result).not.toContain('success');
    });

    it('should be case-insensitive', () => {
      const result = grepLogs(logs, 'ERROR');
      expect(result).toContain('error message');
    });

    it('should support regex patterns', () => {
      const result = grepLogs(logs, 'error|warning');
      expect(result).toContain('error message');
      expect(result).toContain('warning message');
      expect(result).not.toContain('success');
    });

    it('should throw on invalid regex', () => {
      expect(() => grepLogs(logs, '[')).toThrow('Invalid grep pattern');
    });
  });

  describe('truncateLogs', () => {
    it('should truncate by bytes', () => {
      const logs = 'a'.repeat(1000);
      const result = truncateLogs(logs, 500);
      
      expect(result.truncated).toBe(true);
      expect(result.originalSize).toBe(1000);
      expect(result.logs.length).toBeLessThanOrEqual(500);
    });

    it('should truncate by lines', () => {
      const logs = Array(100).fill('line').join('\n');
      const result = truncateLogs(logs, Number.MAX_SAFE_INTEGER, 50);
      
      expect(result.truncated).toBe(true);
      expect(result.logs.split('\n').length).toBe(50);
    });

    it('should not truncate if within limits', () => {
      const logs = 'short log';
      const result = truncateLogs(logs, 1000, 100);
      
      expect(result.truncated).toBe(false);
      expect(result.logs).toBe(logs);
    });

    it('should truncate by lines first, then bytes', () => {
      const logs = Array(100).fill('x'.repeat(100)).join('\n');
      const result = truncateLogs(logs, 1000, 50);
      
      expect(result.truncated).toBe(true);
      // Should be limited to 50 lines and 1000 bytes
    });
  });

  describe('summarizeLogs', () => {
    const logs = `
2023-01-01T10:00:00Z ERROR Database connection failed
2023-01-01T10:00:01Z ERROR Database connection failed
2023-01-01T10:00:02Z WARN Retrying connection
2023-01-01T10:00:03Z INFO Connection established
2023-01-01T10:00:04Z DEBUG Query executed
2023-01-01T10:00:05Z ERROR Timeout occurred
    `.trim();

    it('should count severity levels', () => {
      const summary = summarizeLogs(logs);
      
      expect(summary.severityCounts.ERROR).toBe(3);
      expect(summary.severityCounts.WARN).toBe(1);
      expect(summary.severityCounts.INFO).toBe(1);
      expect(summary.severityCounts.DEBUG).toBe(1);
    });

    it('should extract time range', () => {
      const summary = summarizeLogs(logs);
      
      expect(summary.timeRange.earliest).toContain('2023-01-01');
      expect(summary.timeRange.latest).toContain('2023-01-01');
    });

    it('should count total lines', () => {
      const summary = summarizeLogs(logs);
      expect(summary.totalLines).toBe(6);
    });

    it('should provide estimated bytes', () => {
      const summary = summarizeLogs(logs);
      expect(summary.estimatedBytes).toBeGreaterThan(0);
    });

    it('should extract error patterns', () => {
      const summary = summarizeLogs(logs);
      
      expect(summary.topErrors.length).toBeGreaterThan(0);
      // Should group "Database connection failed" errors together
      const dbPattern = summary.topErrors.find(e => 
        e.pattern.includes('Database connection failed')
      );
      expect(dbPattern).toBeDefined();
      expect(dbPattern?.count).toBe(2);
    });

    it('should provide recent errors', () => {
      const summary = summarizeLogs(logs);
      
      expect(summary.recentErrors.length).toBeGreaterThan(0);
      expect(summary.recentErrors[summary.recentErrors.length - 1]).toContain('Timeout');
    });
  });

  describe('processLogs', () => {
    const logs = `
2023-01-01 ERROR Critical error line 1
2023-01-01 WARN Warning line 2
2023-01-01 INFO Info line 3
2023-01-01 ERROR Critical error line 4
2023-01-01 DEBUG Debug line 5
    `.trim();

    it('should apply severity filter', () => {
      const result = processLogs(logs, { severityFilter: 'ERROR' });
      
      expect(result.logs).toContain('ERROR');
      expect(result.logs).not.toContain('WARN');
    });

    it('should apply grep filter', () => {
      const result = processLogs(logs, { grep: 'Critical' });
      
      expect(result.logs).toContain('Critical error line 1');
      expect(result.logs).toContain('Critical error line 4');
      expect(result.logs).not.toContain('Warning');
    });

    it('should apply multiple filters', () => {
      const result = processLogs(logs, {
        severityFilter: 'ERROR',
        grep: 'line 1',
      });
      
      expect(result.logs).toContain('line 1');
      expect(result.logs).not.toContain('line 4');
    });

    it('should apply size limits', () => {
      const result = processLogs(logs, { maxBytes: 50 });
      
      expect(result.metadata.truncated).toBe(true);
      expect(Buffer.byteLength(result.logs)).toBeLessThanOrEqual(50);
    });

    it('should provide truncation metadata', () => {
      const result = processLogs(logs, { maxBytes: 10 });
      
      expect(result.metadata.truncated).toBe(true);
      expect(result.metadata.originalSize).toBeGreaterThan(10);
    });
  });
});

