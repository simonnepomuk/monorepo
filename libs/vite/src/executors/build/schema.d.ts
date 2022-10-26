export interface BuildExecutorSchema {
  outputPath?: string;
  emptyOutDir?: boolean;
  sourceMap?: boolean;
  generatePackageJson?: Record<string, string>;
}
