import { PreviewExecutorSchema } from './schema';
import { getPackageManagerCommand } from 'nx/src/utils/package-manager';
import execa from 'execa';
import { ExecutorContext } from '@nrwl/devkit';

export default async function runExecutor(
  options: PreviewExecutorSchema,
  context: ExecutorContext
) {
  if (!context.projectName) {
    throw new Error('No projectName');
  }
  const packageManager = getPackageManagerCommand();
  const appRoot = context.workspace.projects[context.projectName].root;

  const vite = execa(packageManager.exec, ['vite', 'preview'], {
    stdio: [process.stdin, process.stdout, 'pipe'],
    cwd: `${context.cwd}/${appRoot}`,
  });

  await vite;

  if (vite.connected) {
    vite.cancel();
  }

  return {
    success: true,
  };
}
