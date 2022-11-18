import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { Builder } from '@sveltejs/kit';
import { HttpsOptions } from 'firebase-functions/lib/v2/providers/https';

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
        useWebFrameworkBeta,
      });

      builder.log.info('Generating production package.json for Firebase...');

      generateProductionPackageJson({
        outDir,
        nodeVersion,
        useWebFrameworkBeta,
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
  builder.mkdirp(join(outDir, '.firebase', 'functions'));

  builder.writeServer(join(outDir, '.firebase', 'server'));

  const replace = {
    '0SERVER': './server/index.js', // digit prefix prevents CJS build from using this as a variable name, which would also get replaced
  };

  const filter = (name: string) => {
    if (name === 'lib') {
      return true;
    }
    return !name.includes('adapter') && name.endsWith('.js');
  };

  builder.copy(`${distPath}`, join(outDir, '.firebase'), { filter, replace });

  builder.log.minor('Generating cloud function...');

  const manifest = builder.generateManifest({
    relativePath: '../server',
    format: 'esm',
  });

  const initImport = `import { init } from './../function.js';`;
  const firebaseFunctionImport = `import { onRequest } from 'firebase-functions/${version}/https';`;
  const imports = [
    initImport,
    useWebFrameworkBeta ? '' : firebaseFunctionImport,
  ];
  const functionOptionsParam = functionOptions
    ? `${JSON.stringify(functionOptions)}, `
    : '';
  const functionConst = useWebFrameworkBeta
    ? `export const ${WEB_FRAMEWORK_FUNCTION_NAME} = init(${manifest});`
    : `export const ${functionName} = onRequest(${functionOptionsParam}init(${manifest}));`;
  const renderFunctionFile = `${imports.join('\n')}\n\n${functionConst}\n`;

  writeFileSync(
    join(outDir, '.firebase', 'functions', 'render.js'),
    renderFunctionFile
  );
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
      serve: '.',
    },
    files: ['*', '**/*'],
    scripts: {
      build: 'echo "No build needed"',
    },
  };
  const firebaseConfig = {
    dependencies: {
      ...packageJson?.dependencies,
      'firebase-functions': '^4.0.1',
    },
    main: '.firebase/functions/render.js',
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
