import * as k8s from '@kubernetes/client-node';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { config } from './settings.js';
import { getKubeconfigFromVM } from '../utils/multipass.js';

/**
 * Load kubeconfig from local file
 */
async function loadLocalKubeconfig(): Promise<k8s.KubeConfig> {
  const kc = new k8s.KubeConfig();
  const kubeconfigPath = path.join(os.homedir(), '.kube', 'config');

  try {
    await fs.access(kubeconfigPath);
    kc.loadFromFile(kubeconfigPath);
    return kc;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load kubeconfig from ${kubeconfigPath}: ${error.message}`
      );
    }
    throw new Error('Failed to load kubeconfig from local file');
  }
}

/**
 * Load kubeconfig from multipass VM
 */
async function loadMultipassKubeconfig(): Promise<k8s.KubeConfig> {
  try {
    const kubeconfigYaml = await getKubeconfigFromVM();
    const kc = new k8s.KubeConfig();
    kc.loadFromString(kubeconfigYaml);
    return kc;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load kubeconfig from VM: ${error.message}`);
    }
    throw new Error('Failed to load kubeconfig from VM');
  }
}

/**
 * Load kubeconfig based on configuration
 */
export async function loadKubeconfig(): Promise<k8s.KubeConfig> {
  if (config.configSource === 'multipass') {
    return loadMultipassKubeconfig();
  } else {
    return loadLocalKubeconfig();
  }
}

/**
 * Test kubeconfig connection
 */
export async function testConnection(kc: k8s.KubeConfig): Promise<boolean> {
  try {
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    await coreApi.listNamespace();
    return true;
  } catch {
    return false;
  }
}
