import * as namespaces from '../src/tools/namespaces';
import * as k8sClient from '../src/utils/k8s-client';

jest.mock('../src/utils/k8s-client');

describe('Namespace Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listNamespaces', () => {
    it('should list namespaces successfully', async () => {
      const mockNamespaces = {
        body: {
          items: [
            {
              metadata: {
                name: 'default',
                creationTimestamp: new Date('2024-01-01'),
              },
              status: {
                phase: 'Active',
              },
            },
            {
              metadata: {
                name: 'kube-system',
                creationTimestamp: new Date('2024-01-01'),
              },
              status: {
                phase: 'Active',
              },
            },
          ],
        },
      };

      const mockCoreApi = {
        listNamespace: jest.fn().mockResolvedValue(mockNamespaces),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getCoreApi as jest.Mock).mockReturnValue(mockCoreApi);

      const result = await namespaces.listNamespaces();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('default');
      expect(result[1].name).toBe('kube-system');
    });
  });

  describe('createNamespace', () => {
    it('should create namespace successfully', async () => {
      const mockCoreApi = {
        createNamespace: jest.fn().mockResolvedValue({}),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getCoreApi as jest.Mock).mockReturnValue(mockCoreApi);

      const result = await namespaces.createNamespace('test-namespace');

      expect(result).toContain('created successfully');
      expect(mockCoreApi.createNamespace).toHaveBeenCalled();
    });
  });

  describe('deleteNamespace', () => {
    it('should delete namespace successfully', async () => {
      const mockCoreApi = {
        deleteNamespace: jest.fn().mockResolvedValue({}),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getCoreApi as jest.Mock).mockReturnValue(mockCoreApi);

      const result = await namespaces.deleteNamespace('test-namespace');

      expect(result).toContain('deletion initiated');
      expect(mockCoreApi.deleteNamespace).toHaveBeenCalledWith('test-namespace');
    });
  });
});

