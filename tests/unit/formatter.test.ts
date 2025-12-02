import { describe, it, expect } from 'vitest';
import { formatResponse, getFormatInfo } from '../../src/utils/formatter.js';

describe('Formatter', () => {
  describe('formatResponse', () => {
    it('should handle null', () => {
      const result = formatResponse(null);
      expect(result).toBe('null');
    });

    it('should handle undefined', () => {
      const result = formatResponse(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle strings directly', () => {
      const result = formatResponse('test string');
      expect(result).toBe('test string');
    });

    it('should format primitives as JSON', () => {
      expect(formatResponse(42)).toBe('42');
      expect(formatResponse(true)).toBe('true');
    });

    it('should format objects as JSON', () => {
      const obj = { key: 'value' };
      const result = formatResponse(obj, 'json');
      expect(JSON.parse(result)).toEqual(obj);
    });

    it('should use TOON for uniform arrays', () => {
      const data = [
        { name: 'pod-1', status: 'Running' },
        { name: 'pod-2', status: 'Pending' },
      ];
      const result = formatResponse(data, 'toon');
      expect(result).toContain('pod-1');
      expect(result).toContain('Running');
    });

    it('should auto-detect format for uniform arrays', () => {
      const data = [
        { name: 'svc-1', type: 'ClusterIP' },
        { name: 'svc-2', type: 'NodePort' },
      ];
      const result = formatResponse(data, 'auto');
      expect(result).toContain('svc-1');
    });
  });

  describe('getFormatInfo', () => {
    it('should recommend JSON for strings', () => {
      const info = getFormatInfo('test');
      expect(info.recommendedFormat).toBe('json');
    });

    it('should recommend TOON for uniform arrays', () => {
      const data = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ];
      const info = getFormatInfo(data);
      expect(info.recommendedFormat).toBe('toon');
    });

    it('should recommend JSON for nested objects', () => {
      const data = {
        nested: {
          deep: {
            value: 'test',
          },
        },
      };
      const info = getFormatInfo(data);
      expect(info.recommendedFormat).toBe('json');
    });
  });
});

