import type { ExecutorContext } from '@nrwl/devkit';
import { writeJsonFile } from '@nrwl/devkit';
import { createPackageJson as generatePackageJson } from '@nrwl/workspace/src/utilities/create-package-json';
import { BuildExecutorSchema } from '../schema';

export async function createPackageJson(
  options: BuildExecutorSchema,
  context: ExecutorContext
) {
  const packageJson = generatePackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
      projectRoot: context.workspace.projects[context.projectName].sourceRoot,
    }
  );
  writeJsonFile(`${options.outputPath}/package.json`, {
    ...packageJson,
    ...options.generatePackageJson,
  });
}
