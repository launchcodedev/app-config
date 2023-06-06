import { _electron as electron, ElectronApplication } from 'playwright';
import { loadConfig, config } from '@app-config/main';
import path from 'path';

let app: ElectronApplication | undefined;

beforeAll(async () => {
  app = await electron.launch({ args: ['--no-sandbox', path.join(__dirname, '..')] });
  return;
});

afterAll(async () => {
  if (app) {
    await app.close();
  }

  return;
});

it('loads config', async () => {
  await loadConfig();

  const window = await app?.firstWindow();

  const electronConfig = await window?.evaluate('window._appConfig');

  return expect(electronConfig).toEqual(config);
});

it('runs user preload script', async () => {
  const window = await app?.firstWindow();

  const userPreloadValue = await window?.evaluate('window.userPreloadTest');

  return expect(userPreloadValue).toEqual(true);
});