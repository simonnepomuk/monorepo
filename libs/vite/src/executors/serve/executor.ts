import { ExecutorContext } from '@nrwl/devkit';
import execa from 'execa';
import { getPackageManagerCommand } from 'nx/src/utils/package-manager';
import { ServeExecutorSchema } from './schema';

export default async function runExecutor(
  _options: ServeExecutorSchema,
  context: ExecutorContext
) {
  if (!context.projectName) {
    throw new Error('No projectName');
  }
  const packageManager = getPackageManagerCommand();
  const appRoot = context.workspace.projects[context.projectName].root;

  const vite = execa(packageManager.exec, ['vite', '--open'], {
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
