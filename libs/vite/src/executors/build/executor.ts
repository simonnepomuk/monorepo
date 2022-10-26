import { ExecutorContext } from '@nrwl/devkit';
import { createPackageJson } from './lib/create-package-json';
import { BuildExecutorSchema } from './schema';
import execa from 'execa';
import { getPackageManagerCommand } from 'nx/src/utils/package-manager';

export default async function runExecutor(
  _options: BuildExecutorSchema,
  context: ExecutorContext
) {
  if (context?.projectName === undefined) {
    throw new Error('No projectName');
  }

  const appRoot = context.workspace.projects[context.projectName].root;

  const packageManager = getPackageManagerCommand();

  const vite = execa(packageManager.exec, ['vite', 'build'], {
    stdio: [process.stdin, process.stdout, 'pipe'],
    cwd: `${context.cwd}/${appRoot}`,
  });

  await vite;

  if (vite.connected) {
    vite.cancel();
  }

  if (_options?.generatePackageJson) {
    console.log('Generating package.json...');
    await createPackageJson(_options, context);
  }

  return {
    success: true,
  };
}
