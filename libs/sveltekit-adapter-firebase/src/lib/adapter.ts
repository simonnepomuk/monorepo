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
  nodeVersion: '14' | '16';
  functionOptions?: HttpsOptions;
};
export default function (options?: AdapterOptions) {
  return {
    name: '@outcom/adapter-firebase',
    async adapt(builder: Builder) {
      const {
        outDir,
        v2,
        functionOptions,
        functionName,
        nodeVersion,
      }: AdapterOptions = options || {
        outDir: 'build',
        v2: true,
        functionOptions: { concurrency: 500 },
        functionName: 'handler',
        nodeVersion: '16',
      };

      // empty out existing build directories
      builder.rimraf(outDir);
      builder.rimraf('.firebase');

      builder.log.minor(`Publishing to "${outDir}"`);

      builder.log.minor('Copying assets...');
      const publishDir = `${outDir}${builder.config.kit.paths.base}`;
      builder.writeClient(publishDir);
      builder.writePrerendered(publishDir);

      if (!v2 && functionOptions) {
        throw new Error('Function options can only be used with v2 functions');
      }

      await generateCloudFunction(
        builder,
        outDir,
        v2,
        nodeVersion,
        functionName,
        functionOptions
      );

      builder.log.info('Generating production package.json for Firebase...');

      generateProductionPackageJson(outDir, nodeVersion);
    },
  };
}

async function generateCloudFunction(
  builder: Builder,
  publish: string,
  v2: boolean,
  nodeVersion: '14' | '16',
  functionName: string,
  functionOptions: unknown
) {
  builder.mkdirp(join(publish, '.firebase', 'functions'));

  builder.writeServer(join(publish, '.firebase', 'server'));

  const replace = {
    '0SERVER': './server/index.js', // digit prefix prevents CJS build from using this as a variable name, which would also get replaced
  };

  const filter = (name: string) => {
    if (name === 'lib') {
      return true;
    }
    return !name.includes('adapter') && name.endsWith('.js');
  };

  builder.copy(`${distPath}`, join(publish, '.firebase'), { filter, replace });

  builder.log.minor('Generating cloud function...');

  const manifest = builder.generateManifest({
    relativePath: '../server',
    format: 'esm',
  });

  const initImport = `import { init } from './../function.js';`;
  const firebaseImportV2 = `import { onRequest } from 'firebase-functions/v2/https';`;
  const functionConstV2 = `export const ${functionName} = onRequest(${
    functionOptions ? JSON.stringify(functionOptions) + ', ' : ''
  }init(${manifest}, ${v2}));`;
  const firebaseImportV1 = `import { https } from 'firebase-functions';`;
  const functionConstV1 = `export const ${functionName} = https.onRequest(init(${manifest}));`;
  const renderFunctionFile = `${initImport}\n${
    v2 ? firebaseImportV2 : firebaseImportV1
  }\n\n${v2 ? functionConstV2 : functionConstV1}\n`;

  writeFileSync(
    join(publish, '.firebase', 'functions', 'render.js'),
    renderFunctionFile
  );
}

function generateProductionPackageJson(
  outDir: string,
  nodeVersion: '14' | '16'
) {
  const packageJsonString = readFileSync('package.json');
  const packageJson = JSON.parse(packageJsonString.toString());
  const firebaseConfig = {
    //Firebase doesn't handle overlapping dev and prod dependencies well, so we set devDeps to null as they are not needed anyway
    devDependencies: null,
    dependencies: {
      ...packageJson.dependencies,
      'firebase-functions': '^3.24.1',
      '@sveltejs/kit': 'next',
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
  writeFileSync(
    join(outDir, 'package.json'),
    JSON.stringify(updatedPackageJson, null, 2)
  );
}
