module.exports = (config) => {
  return {
    ...config,
    input: [
      'libs/sveltekit-adapter-firebase/index.ts',
      'libs/sveltekit-adapter-firebase/src/function.ts',
    ],
    external: (id) => id === '0SERVER',
    preserveEntrySignatures: 'exports-only',
  };
};
