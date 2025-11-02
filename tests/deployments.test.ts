import * as deployments from '../src/tools/deployments';
import * as k8sClient from '../src/utils/k8s-client';

// Mock the k8s client
jest.mock('../src/utils/k8s-client');

describe('Deployment Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDeployments', () => {
    it('should list deployments successfully', async () => {
      const mockDeployments = {
        body: {
          items: [
            {
              metadata: {
                name: 'test-deployment',
                namespace: 'default',
                creationTimestamp: new Date('2024-01-01'),
              },
              spec: {
                replicas: 3,
              },
              status: {
                readyReplicas: 3,
                updatedReplicas: 3,
                availableReplicas: 3,
              },
            },
          ],
        },
      };

      const mockAppsApi = {
        listNamespacedDeployment: jest.fn().mockResolvedValue(mockDeployments),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getAppsApi as jest.Mock).mockReturnValue(mockAppsApi);

      const result = await deployments.listDeployments('default');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-deployment');
      expect(result[0].namespace).toBe('default');
      expect(result[0].ready).toBe('3/3');
      expect(mockAppsApi.listNamespacedDeployment).toHaveBeenCalledWith('default');
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('API Error');
      const mockAppsApi = {
        listNamespacedDeployment: jest.fn().mockRejectedValue(mockError),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getAppsApi as jest.Mock).mockReturnValue(mockAppsApi);

      await expect(deployments.listDeployments('default')).rejects.toThrow(
        'Failed to list deployments'
      );
    });
  });

  describe('scaleDeployment', () => {
    it('should scale deployment successfully', async () => {
      const mockDeployment = {
        body: {
          metadata: { name: 'test-deployment' },
          spec: { replicas: 3 },
        },
      };

      const mockAppsApi = {
        readNamespacedDeployment: jest.fn().mockResolvedValue(mockDeployment),
        replaceNamespacedDeployment: jest.fn().mockResolvedValue({}),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getAppsApi as jest.Mock).mockReturnValue(mockAppsApi);

      const result = await deployments.scaleDeployment('test-deployment', 5, 'default');

      expect(result).toContain('scaled to 5 replicas');
      expect(mockAppsApi.readNamespacedDeployment).toHaveBeenCalledWith(
        'test-deployment',
        'default'
      );
      expect(mockDeployment.body.spec.replicas).toBe(5);
    });
  });

  describe('restartDeployment', () => {
    it('should restart deployment successfully', async () => {
      const mockDeployment = {
        body: {
          metadata: { name: 'test-deployment' },
          spec: {
            template: {
              metadata: {
                annotations: {},
              },
            },
          },
        },
      };

      const mockAppsApi = {
        readNamespacedDeployment: jest.fn().mockResolvedValue(mockDeployment),
        replaceNamespacedDeployment: jest.fn().mockResolvedValue({}),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getAppsApi as jest.Mock).mockReturnValue(mockAppsApi);

      const result = await deployments.restartDeployment('test-deployment', 'default');

      expect(result).toContain('restart initiated');
      const annotations = mockDeployment.body.spec?.template?.metadata?.annotations as Record<string, string> | undefined;
      expect(annotations?.['kubectl.kubernetes.io/restartedAt']).toBeDefined();
    });
  });
});

