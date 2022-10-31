import { Builder } from '@sveltejs/kit';
import { beforeEach, expect, vi } from 'vitest';
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
      join(defaultOptions.outDir, '.firebase', 'functions')
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
    const manifest = '{test: "test"}';
    builderMock.generateManifest.mockReturnValue(manifest);
    const initImport = `import { init } from './../function.js';`;
    const firebaseImportV2 = `import { onRequest } from 'firebase-functions/v2/https';`;
    const functionConstV2 = `export const ${functionName} = onRequest(${
      functionOptions ? JSON.stringify(functionOptions) + ', ' : ''
    }init(${manifest}));`;
    const renderFunctionFile = `${initImport}\n${firebaseImportV2}\n\n${functionConstV2}\n`;
    await adapter({ functionOptions, functionName }).adapt(
      builderMock as unknown as Builder
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      join(defaultOptions.outDir, '.firebase', 'functions', 'render.js'),
      renderFunctionFile
    );
  });
});
