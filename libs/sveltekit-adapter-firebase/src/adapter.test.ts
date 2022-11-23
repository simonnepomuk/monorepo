import { Builder } from '@sveltejs/kit';
import { beforeEach, vi } from 'vitest';
import adapter from './adapter';
import { join } from 'path';
import { writeFileSync } from 'fs';

const defaultOptions = {
  outDir: 'build',
  v2: true,
  functionName: 'handler',
  nodeVersion: '16',
  functionOptions: { concurrency: 500 },
};
const builderMock = {
  rimraf: vi.fn(),
  writeClient: vi.fn(),
  writeServer: vi.fn(),
  copy: vi.fn(),
  generateManifest: vi.fn(),
  writePrerendered: vi.fn(),
  mkdirp: vi.fn(),
  log: {
    minor: vi.fn(),
    info: vi.fn(),
  },
  config: {
    kit: {
      paths: {
        base: '',
      },
    },
  },
};
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue({ dependencies: [] }),
}));
JSON.parse = vi.fn();
describe('Adapter Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should call all necessary builder functions', async () => {
    const publishDir = `${defaultOptions.outDir}${builderMock.config.kit.paths.base}`;
    expect(adapter().name).toBe('sveltekit-adapter-firebase');
    await adapter().adapt(builderMock as unknown as Builder);
    expect(builderMock.writeClient).toHaveBeenCalledWith(publishDir);
    expect(builderMock.writePrerendered).toHaveBeenCalledWith(publishDir);
    expect(builderMock.rimraf).toHaveBeenCalledWith(defaultOptions.outDir);
    expect(builderMock.mkdirp).toHaveBeenCalledWith(
      join(defaultOptions.outDir, '.firebase', 'function')
    );
    expect(builderMock.writeServer).toHaveBeenCalledWith(
      join(defaultOptions.outDir, '.firebase', 'server')
    );
    expect(builderMock.copy).toHaveBeenCalled();
    expect(builderMock.generateManifest).toHaveBeenCalledWith({
      relativePath: '../server',
      format: 'esm',
    });
  });

  test('should use outDir param', async () => {
    await adapter({ outDir: 'testDir' }).adapt(
      builderMock as unknown as Builder
    );
    expect(builderMock.rimraf).toHaveBeenCalledWith('testDir');
  });

  test('should use function options', async () => {
    const functionOptions = {
      ...defaultOptions.functionOptions,
      minInstances: 1,
    };
    const functionName = 'testName';
    const version = 'v2';
    const manifest = '{test: "test"}';
    builderMock.generateManifest.mockReturnValue(manifest);
    const initImport = `import { init } from './function.js';`;
    const firebaseImport = `import { onRequest } from 'firebase-functions/v2/https';`;
    const functionOptionsParam = `${JSON.stringify(functionOptions)}, `;
    const functionConst = `export const ${functionName} = onRequest(${functionOptionsParam}init(${manifest}));`;
    const renderFunctionFile = `${initImport}\n${firebaseImport}\n\n${functionConst}\n`;
    await adapter({ functionOptions, functionName, version }).adapt(
      builderMock as unknown as Builder
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      join(defaultOptions.outDir, '.firebase', 'function', 'entrypoint.js'),
      renderFunctionFile
    );
  });

  test('should throw error when v1 with functionOptions', async () => {
    const version = 'v1';
    expect(async () => {
      await adapter({
        version,
        functionOptions: defaultOptions.functionOptions,
      }).adapt(builderMock as unknown as Builder);
    }).rejects.toThrowError();
  });

  test('should use v1 with options', async () => {
    const version = 'v1';
    const functionName = 'test';
    const nodeVersion = '14';
    const outDir = '../dist/';
    await adapter({
      version,
      nodeVersion,
      functionName,
      outDir,
    }).adapt(builderMock as unknown as Builder);
    const manifest = '{test: "test"}';
    builderMock.generateManifest.mockReturnValue(manifest);
    const initImport = `import { init } from './function.js';`;
    const firebaseImport = `import { onRequest } from 'firebase-functions/v1/https';`;
    const functionConst = `export const ${functionName} = onRequest(init(${manifest}));`;
    const renderFunctionFile = `${initImport}\n${firebaseImport}\n\n${functionConst}\n`;
    expect(writeFileSync).toHaveBeenCalledWith(
      join(outDir, '.firebase', 'function', 'entrypoint.js'),
      renderFunctionFile
    );
  });
});
