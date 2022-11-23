import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { Builder } from '@sveltejs/kit';
import { HttpsOptions } from 'firebase-functions/lib/v2/providers/https';
import { spawnSync } from 'child_process';

const distPath = fileURLToPath(new URL('.', import.meta.url).href);

export type AdapterOptions = {
  outDir?: string;
  functionName?: string;
  version?: 'v1' | 'v2';
  nodeVersion?: '14' | '16';
  functionOptions?: HttpsOptions;
};
export default function (options?: AdapterOptions) {
  return {
    name: 'sveltekit-adapter-firebase',
    adapt: async function (builder: Builder): Promise<void> {
      if (options?.version === 'v1' && options?.functionOptions) {
        throw new Error('Function options can only be used with v2 functions');
      }

      const {
        outDir,
        version,
        functionOptions,
        functionName,
        nodeVersion,
      }: AdapterOptions = {
        outDir: 'build',
        version: 'v2',
        functionName: 'handler',
        nodeVersion: '16',
        ...options,
        functionOptions:
          options?.version === 'v1'
            ? null
            : { concurrency: 500, ...options?.functionOptions },
      };

      // empty out existing build directories
      builder.rimraf(outDir);

      builder.log.minor(`Publishing to "${outDir}"`);

      builder.log.minor('Copying assets...');
      const publishDir = `${outDir}${builder.config.kit.paths.base}`;
      builder.writeClient(publishDir);
      builder.writePrerendered(publishDir);

      builder.log.info('Generating cloud function for Firebase...');

      await generateCloudFunction({
        builder,
        outDir,
        version,
        functionName,
        functionOptions,
      });

      builder.log.info('Generating production package.json for Firebase...');

      generateProductionPackageJson({ outDir, nodeVersion });

      console.log(
        'Installing dependencies in functions directory. This might take a while...'
      );
      spawnSync('npm', ['install'], {
        cwd: outDir,
        stdio: 'inherit',
      });
    },
  };
}

async function generateCloudFunction({
  builder,
  outDir,
  version,
  functionName,
  functionOptions,
}: { builder: Builder } & Omit<AdapterOptions, 'nodeVersion'>) {
  builder.mkdirp(join(outDir, '.firebase', 'function'));

  builder.writeServer(join(outDir, '.firebase', 'server'));

  const replace = {
    '0SERVER': './../server/index.js', // digit prefix prevents CJS build from using this as a variable name, which would also get replaced
  };

  builder.copy(
    join(`${distPath}`, 'function.js'),
    join(outDir, '.firebase', 'function', 'function.js'),
    { replace }
  );
  builder.copy(
    join(`${distPath}`, '_tslib.js'),
    join(outDir, '.firebase', 'function', '_tslib.js')
  );

  builder.log.minor('Generating cloud function...');

  const manifest = builder.generateManifest({
    relativePath: '../server',
    format: 'esm',
  });

  const initImport = `import { init } from './function.js';`;
  const firebaseImport = `import { onRequest } from 'firebase-functions/${version}/https';`;
  const functionOptionsParam = functionOptions
    ? `${JSON.stringify(functionOptions)}, `
    : '';
  const functionConst = `export const ${functionName} = onRequest(${functionOptionsParam}init(${manifest}));`;
  const entrypointFile = `${initImport}\n${firebaseImport}\n\n${functionConst}\n`;

  writeFileSync(
    join(outDir, '.firebase', 'function', 'entrypoint.js'),
    entrypointFile
  );
}

function generateProductionPackageJson({
  outDir,
  nodeVersion,
}: Pick<AdapterOptions, 'outDir' | 'nodeVersion'>) {
  const packageJsonString = readFileSync('package.json');
  const packageJson = JSON.parse(packageJsonString.toString());
  const firebaseConfig = {
    dependencies: {
      ...packageJson?.dependencies,
      'firebase-functions': '^4.0.1',
    },
    main: '.firebase/function/entrypoint.js',
    engines: {
      node: nodeVersion,
    },
    type: 'module',
  };
  const updatedPackageJson = {
    ...packageJson,
    ...firebaseConfig,
  };
  //Firebase doesn't handle overlapping dev and prod dependencies well, so we delete devDeps as they are not needed anyway
  delete updatedPackageJson.devDependencies;
  writeFileSync(
    join(outDir, 'package.json'),
    JSON.stringify(updatedPackageJson, null, 2)
  );
}
