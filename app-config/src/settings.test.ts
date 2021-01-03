import { unlink } from 'fs-extra';
import { loadSettings, saveSettings, settingsDirectory } from './settings';

describe('Loading and saving', () => {
  it('saves and loads settings', async () => {
    // for safety, let's not overwrite user's settings
    if (!process.env.CI) return;

    await saveSettings({});
    await expect(loadSettings()).resolves.toEqual({});
  });
});
