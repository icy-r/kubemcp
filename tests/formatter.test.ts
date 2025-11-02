import { formatResponse, getFormatInfo } from '../src/utils/formatter';

describe('Formatter', () => {
  describe('formatResponse', () => {
    it('should format uniform arrays with TOON in auto mode', () => {
      const data = [
        { name: 'pod1', status: 'Running', cpu: 100 },
        { name: 'pod2', status: 'Pending', cpu: 50 },
      ];

      const result = formatResponse(data, 'auto');
      
      // Should use TOON format (tab-delimited)
      expect(result).toContain('[2\t]');
      expect(result).toContain('name\tstatus\tcpu');
      expect(result).toContain('pod1\tRunning\t100');
    });

    it('should format non-uniform arrays with JSON in auto mode', () => {
      const data = [
        { name: 'pod1', status: 'Running' },
        { name: 'pod2', cpu: 50 }, // Different keys
      ];

      const result = formatResponse(data, 'auto');
      
      // Should use JSON format
      expect(result).toContain('"name"');
      expect(result).toContain('"pod1"');
    });

    it('should always use JSON when format is json', () => {
      const data = [
        { name: 'pod1', status: 'Running' },
        { name: 'pod2', status: 'Pending' },
      ];

      const result = formatResponse(data, 'json');
      
      // Should use JSON format
      expect(result).toContain('"name"');
      expect(result).toContain('"status"');
    });

    it('should always try TOON when format is toon', () => {
      const data = [
        { name: 'pod1', status: 'Running' },
        { name: 'pod2', status: 'Pending' },
      ];

      const result = formatResponse(data, 'toon');
      
      // Should use TOON format
      expect(result).toContain('[2\t]');
    });

    it('should handle strings as-is', () => {
      const logs = 'Line 1\nLine 2\nLine 3';
      const result = formatResponse(logs);
      
      expect(result).toBe(logs);
    });

    it('should handle primitives with JSON', () => {
      expect(formatResponse(42)).toBe('42');
      expect(formatResponse(true)).toBe('true');
      expect(formatResponse(null)).toBe('null');
    });

    it('should handle objects with uniform arrays', () => {
      const data = {
        pods: [
          { name: 'pod1', status: 'Running' },
          { name: 'pod2', status: 'Pending' },
        ],
      };

      const result = formatResponse(data, 'auto');
      
      // Should use TOON since it contains uniform array
      expect(result).toContain('pods[2\t]');
    });

    it('should handle nested objects with JSON', () => {
      const data = {
        metadata: {
          name: 'test',
          nested: {
            value: 123,
          },
        },
      };

      const result = formatResponse(data, 'auto');
      
      // Should use JSON for nested structures
      expect(result).toContain('"metadata"');
      expect(result).toContain('"nested"');
    });
  });

  describe('getFormatInfo', () => {
    it('should recommend TOON for uniform arrays', () => {
      const data = [
        { name: 'pod1', status: 'Running' },
        { name: 'pod2', status: 'Pending' },
      ];

      const info = getFormatInfo(data);
      
      expect(info.recommendedFormat).toBe('toon');
      expect(info.reason).toContain('Uniform array');
    });

    it('should recommend JSON for non-uniform arrays', () => {
      const data = [
        { name: 'pod1' },
        { status: 'Running' },
      ];

      const info = getFormatInfo(data);
      
      expect(info.recommendedFormat).toBe('json');
    });

    it('should recommend JSON for strings', () => {
      const info = getFormatInfo('test string');
      
      expect(info.recommendedFormat).toBe('json');
      expect(info.reason).toContain('String data');
    });

    it('should recommend JSON for primitives', () => {
      expect(getFormatInfo(42).recommendedFormat).toBe('json');
      expect(getFormatInfo(true).recommendedFormat).toBe('json');
      expect(getFormatInfo(null).recommendedFormat).toBe('json');
    });
  });
});

