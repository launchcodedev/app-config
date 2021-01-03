import { loadSettings, saveSettings, settingsDirectory } from './settings';
import { withTempFiles } from './test-util';

describe('Loading and saving', () => {
  it('saves and loads settings', () =>
    withTempFiles({}, async (inDir) => {
      process.env.APP_CONFIG_SETTINGS_FOLDER = inDir('settings');

      expect(settingsDirectory()).toEqual(inDir('settings'));

      await saveSettings({});
      await expect(loadSettings()).resolves.toEqual({});
    }));
});
