import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { Builder } from '@sveltejs/kit';
import { HttpsOptions } from 'firebase-functions/lib/v2/providers/https';

const distPath = fileURLToPath(new URL('.', import.meta.url).href);

export type AdapterOptions = {
  outDir?: string;
  functionName?: string;
  v2?: boolean;
  nodeVersion?: '14' | '16';
  functionOptions?: HttpsOptions;
};
export default function (options?: AdapterOptions) {
  return {
    name: 'sveltekit-adapter-firebase',
    async adapt(builder: Builder) {
      const {
        outDir,
        v2,
        functionOptions,
        functionName,
        nodeVersion,
      }: AdapterOptions = {
        outDir: 'build',
        v2: true,
        functionName: 'handler',
        nodeVersion: '16',
        ...options,
        functionOptions: { concurrency: 500, ...options?.functionOptions },
      };

      // empty out existing build directories
      builder.rimraf(outDir);

      builder.log.minor(`Publishing to "${outDir}"`);

      builder.log.minor('Copying assets...');
      const publishDir = `${outDir}${builder.config.kit.paths.base}`;
      builder.writeClient(publishDir);
      builder.writePrerendered(publishDir);

      if (!v2 && functionOptions) {
        throw new Error('Function options can only be used with v2 functions');
      }

      builder.log.info('Generating cloud function for Firebase...');

      await generateCloudFunction({
        builder,
        outDir,
        v2,
        functionName,
        functionOptions,
      });

      builder.log.info('Generating production package.json for Firebase...');

      generateProductionPackageJson({ outDir, nodeVersion });
    },
  };
}

async function generateCloudFunction({
  builder,
  outDir,
  v2,
  functionName,
  functionOptions,
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
  const versionString = v2 ? 'v2' : 'v1';
  const firebaseImport = `import { onRequest } from 'firebase-functions/${versionString}/https';`;
  const functionOptionsParam =
    v2 && functionOptions ? `${JSON.stringify(functionOptions)}, ` : '';
  const functionConst = `export const ${functionName} = onRequest(${functionOptionsParam}init(${manifest}));`;
  const renderFunctionFile = `${initImport}\n${firebaseImport}\n\n${functionConst}\n`;

  writeFileSync(
    join(outDir, '.firebase', 'functions', 'render.js'),
    renderFunctionFile
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
    main: '.firebase/functions/render.js',
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
