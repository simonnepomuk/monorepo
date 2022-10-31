import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  webServer: {
    command: 'nx build test-app && nx preview test-app',
    port: 5000,
    timeout: 30000,
  },
};

export default config;
