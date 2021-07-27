import { app, BrowserWindow } from 'electron';
import { addAppConfigPreload } from '@app-config/electron';
import { loadConfig, config } from '@app-config/main';
import path from 'path';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: addAppConfigPreload(config, { preload: process.env.NODE_ENV === 'test' ? path.join(__dirname, 'preload-test.js') : undefined }),
  });

  mainWindow.loadFile('./index.html');
}

app.whenReady().then(() => {
  loadConfig().then(() => createWindow());
});

app.on('window-all-closed', function () {
  app.quit();
});
