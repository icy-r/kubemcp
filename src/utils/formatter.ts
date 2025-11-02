import { encode } from '@toon-format/toon';

/**
 * Response format types
 */
export type ResponseFormat = 'json' | 'toon' | 'auto';

/**
 * Configuration for response formatting
 */
export interface FormatterConfig {
  format: ResponseFormat;
}

/**
 * Check if data is a uniform array of objects (ideal for TOON)
 */
function isUniformArray(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  // Check if all elements are objects (not null or array)
  const allObjects = data.every(
    (item) => typeof item === 'object' && item !== null && !Array.isArray(item)
  );

  if (!allObjects) {
    return false;
  }

  // Get keys from first object
  const firstKeys = Object.keys(data[0] as object).sort();
  
  if (firstKeys.length === 0) {
    return false;
  }

  // Check if all objects have the same keys and primitive values
  return data.every((item) => {
    const obj = item as Record<string, unknown>;
    const keys = Object.keys(obj).sort();

    // Same number of keys
    if (keys.length !== firstKeys.length) {
      return false;
    }

    // Same key names
    if (!keys.every((key, idx) => key === firstKeys[idx])) {
      return false;
    }

    // All values should be primitives (not objects or arrays)
    return keys.every((key) => {
      const value = obj[key];
      return (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      );
    });
  });
}

/**
 * Check if data should use TOON encoding
 */
function shouldUseToon(data: unknown): boolean {
  // TOON is ideal for uniform arrays
  if (isUniformArray(data)) {
    return true;
  }

  // Check if it's an object with array properties that are uniform
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const values = Object.values(obj);
    
    // If it contains at least one uniform array, use TOON
    return values.some((value) => isUniformArray(value));
  }

  return false;
}

/**
 * Format data for MCP response
 */
export function formatResponse(
  data: unknown,
  format: ResponseFormat = 'auto'
): string {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return JSON.stringify(data, null, 2);
  }

  // Handle strings (like logs) - always use as-is
  if (typeof data === 'string') {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return JSON.stringify(data, null, 2);
  }

  // Determine format
  let useFormat: 'json' | 'toon' = 'json';
  
  if (format === 'toon') {
    useFormat = 'toon';
  } else if (format === 'auto') {
    useFormat = shouldUseToon(data) ? 'toon' : 'json';
  }

  // Format based on decision
  if (useFormat === 'toon') {
    try {
      // Use tab delimiter for better token efficiency
      return encode(data, { delimiter: '\t' });
    } catch (error) {
      // Fallback to JSON if TOON encoding fails
      console.error('TOON encoding failed, falling back to JSON:', error);
      return JSON.stringify(data, null, 2);
    }
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Get format hint for debugging
 */
export function getFormatInfo(data: unknown): {
  recommendedFormat: 'json' | 'toon';
  reason: string;
} {
  if (typeof data === 'string') {
    return { recommendedFormat: 'json', reason: 'String data' };
  }

  if (typeof data !== 'object' || data === null) {
    return { recommendedFormat: 'json', reason: 'Primitive data' };
  }

  if (isUniformArray(data)) {
    return {
      recommendedFormat: 'toon',
      reason: 'Uniform array of objects with primitive values',
    };
  }

  if (shouldUseToon(data)) {
    return {
      recommendedFormat: 'toon',
      reason: 'Object contains uniform arrays',
    };
  }

  return {
    recommendedFormat: 'json',
    reason: 'Non-uniform or nested structure',
  };
}

