import { app, BrowserWindow } from 'electron';
import { addAppConfigPreload } from '@app-config/electron';
import { loadConfig, config } from '@app-config/main';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: addAppConfigPreload(config),
  });

  mainWindow.loadFile('./index.html')
}

app.whenReady().then(() => {
  loadConfig().then(() => createWindow())
});

app.on('window-all-closed', function () {
  app.quit();
});