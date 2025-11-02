import * as pods from '../src/tools/pods';
import * as k8sClient from '../src/utils/k8s-client';

jest.mock('../src/utils/k8s-client');

describe('Pod Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listPods', () => {
    it('should list pods successfully', async () => {
      const mockPods = {
        body: {
          items: [
            {
              metadata: {
                name: 'test-pod',
                namespace: 'default',
                creationTimestamp: new Date('2024-01-01'),
              },
              spec: {
                nodeName: 'node-1',
              },
              status: {
                phase: 'Running',
                podIP: '10.0.0.1',
                containerStatuses: [
                  {
                    ready: true,
                    restartCount: 0,
                  },
                ],
              },
            },
          ],
        },
      };

      const mockCoreApi = {
        listNamespacedPod: jest.fn().mockResolvedValue(mockPods),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getCoreApi as jest.Mock).mockReturnValue(mockCoreApi);

      const result = await pods.listPods('default');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-pod');
      expect(result[0].status).toBe('Running');
      expect(result[0].ready).toBe('1/1');
    });
  });

  describe('deletePod', () => {
    it('should delete pod successfully', async () => {
      const mockCoreApi = {
        deleteNamespacedPod: jest.fn().mockResolvedValue({}),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getCoreApi as jest.Mock).mockReturnValue(mockCoreApi);

      const result = await pods.deletePod('test-pod', 'default');

      expect(result).toContain('deleted successfully');
      expect(mockCoreApi.deleteNamespacedPod).toHaveBeenCalledWith('test-pod', 'default');
    });
  });

  describe('getPodLogs', () => {
    it('should get pod logs successfully', async () => {
      const mockLogs = 'Log line 1\nLog line 2\nLog line 3';
      const mockCoreApi = {
        readNamespacedPodLog: jest.fn().mockResolvedValue({ body: mockLogs }),
      };

      (k8sClient.ensureInitialized as jest.Mock).mockResolvedValue(undefined);
      (k8sClient.k8sClient.getCoreApi as jest.Mock).mockReturnValue(mockCoreApi);

      const result = await pods.getPodLogs('test-pod', 'default', undefined, 100);

      expect(result).toBe(mockLogs);
      expect(mockCoreApi.readNamespacedPodLog).toHaveBeenCalled();
    });
  });
});

