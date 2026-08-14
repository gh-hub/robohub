// IPC channel names shared between the main process (ipcMain.handle /
// webContents.send) and the preload script (ipcRenderer.invoke / .on).
// Kept in a module with no Electron dependency so it can be imported by
// main, preload, and tests alike without pulling in ipcMain/ipcRenderer.

export const CAR_CONNECT_CHANNEL = "car:connect";
export const CAR_DISCONNECT_CHANNEL = "car:disconnect";
export const CAR_STATUS_CHANNEL = "car:status";
