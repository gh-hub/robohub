// IPC channel names shared between the main process (ipcMain.handle /
// webContents.send) and the preload script (ipcRenderer.invoke / .on).
// Kept in a module with no Electron dependency so it can be imported by
// main, preload, and tests alike without pulling in ipcMain/ipcRenderer.

export const CAR_CONNECT_CHANNEL = "car:connect";
export const CAR_DISCONNECT_CHANNEL = "car:disconnect";
export const CAR_STATUS_CHANNEL = "car:status";
export const CAR_SET_LIGHTS_CHANNEL = "car:set-lights";
export const CAR_SET_MOVEMENT_CHANNEL = "car:set-movement";
export const CAR_SHOOT_CHANNEL = "car:shoot";
export const CAR_SET_AIM_ANGLE_CHANNEL = "car:set-aim-angle";
export const CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL = "car:set-distance-sensor-angle";
export const CAR_USB_STATUS_CHANNEL = "car:usb-status";
export const CAR_WIFI_LOG_LINE_CHANNEL = "car:wifi-log-line";
export const CAR_USB_LOG_CONNECT_CHANNEL = "car:usb-log-connect";
export const CAR_USB_LOG_DISCONNECT_CHANNEL = "car:usb-log-disconnect";
export const CAR_USB_LOG_LINE_CHANNEL = "car:usb-log-line";
export const CAR_USB_LOG_STATUS_CHANNEL = "car:usb-log-status";
