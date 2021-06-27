import { app, BrowserWindow } from 'electron';
import { addAppConfigPreload } from '@app-config/electron';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: addAppConfigPreload()
  });

  mainWindow.loadFile('./index.html')
}

app.whenReady().then(() => {
  createWindow()
});

app.on('window-all-closed', function () {
  app.quit();
});
