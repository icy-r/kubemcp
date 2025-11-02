/**
 * Log severity levels
 */
export type LogSeverity = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

/**
 * Log filter options
 */
export interface LogFilterOptions {
  severityFilter?: LogSeverity;
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

/**
 * Detect severity level from a log line
 */
export function detectSeverity(line: string): LogSeverity | 'UNKNOWN' {
  const upperLine = line.toUpperCase();

  // Try to find severity markers (check more specific ones first to avoid false matches)
  if (
    upperLine.includes('ERROR') ||
    upperLine.includes('FATAL') ||
    upperLine.includes('SEVERE') ||
    upperLine.includes('"LEVEL":"ERROR"') ||
    upperLine.includes('LEVEL=ERROR')
  ) {
    return 'ERROR';
  }

  if (
    upperLine.includes('WARN') ||
    upperLine.includes('WARNING') ||
    upperLine.includes('"LEVEL":"WARN"') ||
    upperLine.includes('LEVEL=WARN')
  ) {
    return 'WARN';
  }

  // Check DEBUG before INFO to avoid "debug info" matching INFO
  if (
    upperLine.includes('DEBUG') ||
    upperLine.includes('"LEVEL":"DEBUG"') ||
    upperLine.includes('LEVEL=DEBUG')
  ) {
    return 'DEBUG';
  }

  if (
    upperLine.includes('TRACE') ||
    upperLine.includes('"LEVEL":"TRACE"') ||
    upperLine.includes('LEVEL=TRACE')
  ) {
    return 'TRACE';
  }

  if (
    upperLine.includes('INFO') ||
    upperLine.includes('"LEVEL":"INFO"') ||
    upperLine.includes('LEVEL=INFO')
  ) {
    return 'INFO';
  }

  return 'UNKNOWN';
}

/**
 * Filter logs by severity level
 * Returns only lines matching the specified severity or higher priority
 */
export function filterBySeverity(logs: string, severity: LogSeverity): string {
  const lines = logs.split('\n');
  const severityPriority: Record<string, number> = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4,
    UNKNOWN: 5,
  };

  const targetPriority = severityPriority[severity];

  const filteredLines = lines.filter((line) => {
    if (!line.trim()) return false;
    const lineSeverity = detectSeverity(line);
    return severityPriority[lineSeverity] <= targetPriority;
  });

  return filteredLines.join('\n');
}

/**
 * Filter logs using grep-style regex matching
 */
export function grepLogs(logs: string, pattern: string): string {
  try {
    const regex = new RegExp(pattern, 'i');
    const lines = logs.split('\n');
    const matchedLines = lines.filter((line) => regex.test(line));
    return matchedLines.join('\n');
  } catch {
    throw new Error(`Invalid grep pattern: ${pattern}`);
  }
}

/**
 * Truncate logs to maximum size
 */
export function truncateLogs(
  logs: string,
  maxBytes: number,
  maxLines?: number
): { logs: string; truncated: boolean; originalSize: number } {
  const originalSize = Buffer.byteLength(logs, 'utf8');
  let result = logs;
  let truncated = false;

  // First truncate by lines if specified
  if (maxLines !== undefined) {
    const lines = logs.split('\n');
    if (lines.length > maxLines) {
      result = lines.slice(0, maxLines).join('\n');
      truncated = true;
    }
  }

  // Then truncate by bytes
  if (Buffer.byteLength(result, 'utf8') > maxBytes) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf8', { fatal: false });
    const encoded = encoder.encode(result);
    const truncatedEncoded = encoded.slice(0, maxBytes);
    result = decoder.decode(truncatedEncoded);
    truncated = true;
  }

  return {
    logs: result,
    truncated,
    originalSize,
  };
}

/**
 * Extract error patterns from logs
 */
function extractErrorPatterns(lines: string[]): Map<string, string[]> {
  const patterns = new Map<string, string[]>();

  for (const line of lines) {
    const severity = detectSeverity(line);
    if (severity !== 'ERROR') continue;

    // Try to extract a pattern (remove timestamps, IDs, specific values)
    let pattern = line
      // Remove timestamps
      .replace(
        /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g,
        '<TIMESTAMP>'
      )
      // Remove UUIDs
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '<UUID>'
      )
      // Remove IPs
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>')
      // Remove numbers that look like IDs
      .replace(/\b\d{5,}\b/g, '<ID>')
      // Truncate to reasonable length
      .substring(0, 200);

    if (!patterns.has(pattern)) {
      patterns.set(pattern, []);
    }
    patterns.get(pattern)!.push(line);
  }

  return patterns;
}

/**
 * Summarize logs and return statistics
 */
export function summarizeLogs(logs: string): LogSummary {
  const lines = logs.split('\n').filter((line) => line.trim());

  const severityCounts = {
    ERROR: 0,
    WARN: 0,
    INFO: 0,
    DEBUG: 0,
    TRACE: 0,
    UNKNOWN: 0,
  };

  const errors: string[] = [];
  let earliestTime: string | undefined;
  let latestTime: string | undefined;

  // Process each line
  for (const line of lines) {
    const severity = detectSeverity(line);
    severityCounts[severity]++;

    // Collect errors for pattern analysis
    if (severity === 'ERROR') {
      errors.push(line);
    }

    // Try to extract timestamp
    const timeMatch = line.match(
      /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/
    );
    if (timeMatch) {
      const timestamp = timeMatch[0];
      if (!earliestTime) earliestTime = timestamp;
      latestTime = timestamp;
    }
  }

  // Extract error patterns
  const errorPatterns = extractErrorPatterns(errors);

  // Get top error patterns
  const topErrors = Array.from(errorPatterns.entries())
    .map(([pattern, samples]) => ({
      pattern,
      count: samples.length,
      sample: samples[0],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get most recent errors
  const recentErrors = errors.slice(-5);

  return {
    totalLines: lines.length,
    estimatedBytes: Buffer.byteLength(logs, 'utf8'),
    timeRange: {
      earliest: earliestTime,
      latest: latestTime,
    },
    severityCounts,
    topErrors,
    recentErrors,
  };
}

/**
 * Apply all filters to logs
 */
export function processLogs(
  logs: string,
  options: LogFilterOptions
): { logs: string; metadata: { truncated: boolean; originalSize: number } } {
  let result = logs;

  // Apply severity filter
  if (options.severityFilter) {
    result = filterBySeverity(result, options.severityFilter);
  }

  // Apply grep filter
  if (options.grep) {
    result = grepLogs(result, options.grep);
  }

  // Apply size limits
  const truncateResult = truncateLogs(
    result,
    options.maxBytes || Number.MAX_SAFE_INTEGER,
    options.maxLines
  );

  return {
    logs: truncateResult.logs,
    metadata: {
      truncated: truncateResult.truncated,
      originalSize: truncateResult.originalSize,
    },
  };
}
