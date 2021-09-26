import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('userPreloadTest', true);
