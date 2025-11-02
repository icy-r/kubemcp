import * as k8s from '@kubernetes/client-node';
import { loadKubeconfig } from '../config/kubeconfig.js';

/**
 * Singleton class for managing Kubernetes client
 */
class K8sClientManager {
  private kubeConfig: k8s.KubeConfig | null = null;
  private coreApi: k8s.CoreV1Api | null = null;
  private appsApi: k8s.AppsV1Api | null = null;
  private metricsApi: k8s.Metrics | null = null;

  /**
   * Initialize the Kubernetes client
   */
  async initialize(): Promise<void> {
    try {
      this.kubeConfig = await loadKubeconfig();
      this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
      this.appsApi = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
      this.metricsApi = new k8s.Metrics(this.kubeConfig);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to initialize Kubernetes client: ${error.message}`
        );
      }
      throw new Error('Failed to initialize Kubernetes client');
    }
  }

  /**
   * Get the kubeconfig
   */
  getKubeConfig(): k8s.KubeConfig {
    if (!this.kubeConfig) {
      throw new Error(
        'Kubernetes client not initialized. Call initialize() first.'
      );
    }
    return this.kubeConfig;
  }

  /**
   * Get the Core V1 API client
   */
  getCoreApi(): k8s.CoreV1Api {
    if (!this.coreApi) {
      throw new Error(
        'Kubernetes client not initialized. Call initialize() first.'
      );
    }
    return this.coreApi;
  }

  /**
   * Get the Apps V1 API client
   */
  getAppsApi(): k8s.AppsV1Api {
    if (!this.appsApi) {
      throw new Error(
        'Kubernetes client not initialized. Call initialize() first.'
      );
    }
    return this.appsApi;
  }

  /**
   * Get the Metrics API client
   */
  getMetricsApi(): k8s.Metrics {
    if (!this.metricsApi) {
      throw new Error(
        'Kubernetes client not initialized. Call initialize() first.'
      );
    }
    return this.metricsApi;
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.kubeConfig !== null;
  }

  /**
   * Reset the client (useful for testing or reconnecting)
   */
  reset(): void {
    this.kubeConfig = null;
    this.coreApi = null;
    this.appsApi = null;
    this.metricsApi = null;
  }
}

// Export singleton instance
export const k8sClient = new K8sClientManager();

/**
 * Ensure the client is initialized before use
 */
export async function ensureInitialized(): Promise<void> {
  if (!k8sClient.isInitialized()) {
    await k8sClient.initialize();
  }
}

/**
 * Handle Kubernetes API errors and format them
 */
export function handleK8sError(error: unknown): string {
  if (error instanceof Error) {
    // Check if it's a Kubernetes API error
    if (
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null
    ) {
      const response = error.response as { body?: { message?: string } };
      if (response.body?.message) {
        return response.body.message;
      }
    }
    return error.message;
  }
  return 'Unknown error occurred';
}
