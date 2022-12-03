import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { Builder } from '@sveltejs/kit';
import { HttpsOptions } from 'firebase-functions/lib/v2/providers/https';
import { spawnSync } from 'child_process';

const distPath = fileURLToPath(new URL('.', import.meta.url).href);
const WEB_FRAMEWORK_FUNCTION_NAME = 'handle';

export type AdapterOptions = {
  outDir?: string;
  functionName?: string;
  version?: 'v1' | 'v2';
  nodeVersion?: '14' | '16';
  functionOptions?: HttpsOptions;
  useWebFrameworkBeta?: boolean;
};

export default function (options?: AdapterOptions) {
  return {
    name: 'sveltekit-adapter-firebase',
    adapt: async function (builder: Builder): Promise<void> {
      validateConfig(options);

      const {
        outDir,
        version,
        functionOptions,
        functionName,
        nodeVersion,
        useWebFrameworkBeta,
      }: AdapterOptions = {
        outDir: 'build',
        version: 'v2',
        functionName: 'handler',
        nodeVersion: '16',
        useWebFrameworkBeta: false,
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
      const publishDir = join(outDir, builder.config.kit.paths.base, 'hosting');
      builder.writeClient(publishDir);
      builder.writePrerendered(publishDir);

      builder.log.info('Generating cloud function for Firebase...');

      await generateCloudFunction({
        builder,
        outDir,
        version,
        functionName,
        functionOptions,
        useWebFrameworkBeta,
      });

      builder.log.info('Generating production package.json for Firebase...');

      generateProductionPackageJson({
        outDir,
        nodeVersion,
        useWebFrameworkBeta,
      });

      console.log(
        'Installing dependencies in output directory. This might take a while...'
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
  useWebFrameworkBeta,
}: { builder: Builder } & Omit<AdapterOptions, 'nodeVersion'>) {
  builder.mkdirp(join(outDir, 'function'));

  builder.writeServer(join(outDir, 'server'));

  const replace = {
    '0SERVER': './../server/index.js', // digit prefix prevents CJS build from using this as a variable name, which would also get replaced
  };

  builder.copy(
    join(`${distPath}`, 'function.js'),
    join(outDir, 'function', 'function.js'),
    { replace }
  );
  builder.copy(
    join(`${distPath}`, '_tslib.js'),
    join(outDir, 'function', '_tslib.js')
  );

  builder.log.minor('Generating cloud function...');

  const manifest = builder.generateManifest({
    relativePath: '../server',
    format: 'esm',
  });

  const initImport = `import { init } from './function.js';`;
  const firebaseFunctionImport = useWebFrameworkBeta
    ? undefined
    : `import { onRequest } from 'firebase-functions/${version}/https';`;
  const imports = [initImport, firebaseFunctionImport].filter(Boolean);
  const functionOptionsParam = functionOptions
    ? `${JSON.stringify(functionOptions)}, `
    : '';
  const functionConst = useWebFrameworkBeta
    ? `export const ${WEB_FRAMEWORK_FUNCTION_NAME} = init(${manifest});`
    : `export const ${functionName} = onRequest(${functionOptionsParam}init(${manifest}));`;
  const entrypointFile = `${imports.join('\n')}\n\n${functionConst}\n`;

  writeFileSync(join(outDir, 'function', 'entrypoint.js'), entrypointFile);
}

function generateProductionPackageJson({
  outDir,
  nodeVersion,
  useWebFrameworkBeta,
}: Pick<AdapterOptions, 'outDir' | 'nodeVersion' | 'useWebFrameworkBeta'>) {
  const packageJsonString = readFileSync('package.json');
  const packageJson = JSON.parse(packageJsonString.toString());
  const webFrameworkBetaConfig = {
    directories: {
      serve: 'hosting',
    },
    files: ['hosting', 'function', 'server'],
    scripts: {
      build: 'echo "No build needed"',
    },
  };
  const firebaseConfig = {
    dependencies: {
      ...packageJson?.dependencies,
      'firebase-functions': '^4.0.1',
    },
    main: 'function/entrypoint.js',
    engines: {
      node: nodeVersion,
    },
    type: 'module',
  };
  const updatedPackageJson = {
    ...packageJson,
    ...firebaseConfig,
    ...(useWebFrameworkBeta ? webFrameworkBetaConfig : {}),
  };

  //Firebase doesn't handle overlapping dev and prod dependencies well, so we delete devDeps as they are not needed anyway
  delete updatedPackageJson.devDependencies;

  if (useWebFrameworkBeta) {
    //The following are not needed when utilizing the web framework support
    delete updatedPackageJson.engines;
    delete updatedPackageJson?.dependencies['firebase-functions'];
  }

  writeFileSync(
    join(outDir, 'package.json'),
    JSON.stringify(updatedPackageJson, null, 2)
  );
}

function validateConfig(options: AdapterOptions) {
  if (options?.version === 'v1' && options?.functionOptions) {
    throw new Error('Function options can only be used with v2 functions');
  }

  if (options?.useWebFrameworkBeta && options?.functionName) {
    throw new Error(
      'Web Framework Beta currently requires function to be named "handle"'
    );
  }

  if (options?.useWebFrameworkBeta && options?.functionOptions) {
    throw new Error(
      'Web Framework Beta currently does not support function options'
    );
  }

  if (options?.useWebFrameworkBeta && options?.version) {
    throw new Error(
      'Web Framework Beta currently does not support setting function version'
    );
  }
}
