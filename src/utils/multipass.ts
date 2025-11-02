import { execa } from 'execa';
import { config } from '../config/settings.js';

/**
 * Execute a multipass command
 */
export async function executeMultipassCommand(args: string[]): Promise<string> {
  try {
    const { stdout } = await execa('multipass', args);
    return stdout;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Multipass command failed: ${error.message}`);
    }
    throw new Error('Multipass command failed with unknown error');
  }
}

/**
 * Get kubeconfig from MicroK8s VM via multipass
 */
export async function getKubeconfigFromVM(): Promise<string> {
  try {
    const vmName = config.vmName;
    const output = await executeMultipassCommand([
      'exec',
      vmName,
      '--',
      'sudo',
      'microk8s',
      'config',
    ]);
    return output;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to get kubeconfig from VM '${config.vmName}': ${error.message}`
      );
    }
    throw new Error('Failed to get kubeconfig from VM with unknown error');
  }
}

/**
 * Check if multipass is available
 */
export async function isMultipassAvailable(): Promise<boolean> {
  try {
    await execa('multipass', ['version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if VM is running
 */
export async function isVMRunning(vmName: string): Promise<boolean> {
  try {
    const output = await executeMultipassCommand(['info', vmName]);
    return output.includes('State: Running');
  } catch {
    return false;
  }
}

/**
 * Get VM IP address
 */
export async function getVMIP(vmName: string): Promise<string | null> {
  try {
    const output = await executeMultipassCommand(['info', vmName]);
    const ipMatch = output.match(/IPv4:\s+(\d+\.\d+\.\d+\.\d+)/);
    return ipMatch ? ipMatch[1] : null;
  } catch {
    return null;
  }
}
