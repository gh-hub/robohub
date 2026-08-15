Connecting your Electron desktop app to your ACEBOTT QD001 over Bluetooth on a Mac requires shifting from standard TCP/WebSockets to **Web Bluetooth** or Node-native BLE packages like `@abandonware/noble`.

> **Important Mac Constraint:** macOS does **not** support traditional "Bluetooth Classic" SPP (Serial Port Profile) via standard Web APIs. The ACEBOTT ESP32 must transmit using **Bluetooth Low Energy (BLE)** (e.g., standard Nordic UART Service) for macOS and Electron to talk to it cleanly without manual OS pairing hassles.

---

## 1. ESP32 Side (Arduino Code)

Your QD001’s ESP32 board needs to host a **BLE UART Service** so it can receive text/byte commands over Bluetooth.

Upload this sketch (or adapt your existing drive logic):

```cpp
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Standard Nordic UART Service UUIDs (used by most BLE Serial apps)
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E" // Write to Car
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E" // Read from Car

BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; };
    void onDisconnect(BLEServer* pServer) { deviceConnected = false; }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        char cmd = rxValue[0]; // e.g., 'F' for forward, 'B' for back, 'S' for stop
        
        // --- ADD YOUR ACEBOTT QD001 MOTOR LOGIC HERE ---
        if (cmd == 'F') { /* Drive Forward */ }
        else if (cmd == 'B') { /* Drive Backward */ }
        else if (cmd == 'S') { /* Stop */ }
      }
    }
};

void setup() {
  Serial.begin(115200);
  
  BLEDevice::init("ACEBOTT-QD001");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_RX,
                        BLECharacteristic::PROPERTY_WRITE
                      );
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("ACEBOTT Bluetooth Ready! Waiting for Electron...");
}

void loop() {}

```

---

## 2. Electron App Side

Chromium includes **Web Bluetooth API** natively, which works out-of-the-box in Electron on macOS without needing heavy Native Node C++ bindings.

### Main Process (`main.js`)

Electron requires you to explicitly grant permission for Bluetooth scanning in the Main process.

```javascript
const { app, BrowserWindow } = require('electron');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Handle Mac Web Bluetooth Device Selection
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    // Automatically pick the ACEBOTT car if found, or pick the first device
    const result = deviceList.find((device) => device.deviceName === 'ACEBOTT-QD001');
    if (result) {
      callback(result.deviceId);
    } else if (deviceList.length > 0) {
      callback(deviceList[0].deviceId);
    }
  });
});

```

### Renderer Process (`renderer.js`)

Use standard JavaScript Web Bluetooth to scan, pair, and write commands to the RX characteristic.

```javascript
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

let rxCharacteristic = null;

async function connectToCar() {
  try {
    console.log('Scanning for ACEBOTT-QD001...');
    
    // Request the Bluetooth Device
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'ACEBOTT-QD001' }],
      optionalServices: [SERVICE_UUID]
    });

    console.log('Connecting to GATT Server...');
    const server = await device.gatt.connect();

    console.log('Getting Service...');
    const service = await server.getPrimaryService(SERVICE_UUID);

    console.log('Getting RX Characteristic...');
    rxCharacteristic = await service.getCharacteristic(RX_CHARACTERISTIC_UUID);

    console.log('Connected to ACEBOTT QD001 over Bluetooth!');
  } catch (error) {
    console.error('Bluetooth connection failed:', error);
  }
}

// Function to send commands (e.g., 'F', 'B', 'S')
async function sendCommand(command) {
  if (!rxCharacteristic) {
    console.error('Not connected to car!');
    return;
  }
  const encoder = new TextEncoder();
  await rxCharacteristic.writeValue(encoder.encode(command));
}

// Example usage:
document.getElementById('connectBtn').addEventListener('click', connectToCar);
document.getElementById('forwardBtn').addEventListener('click', () => sendCommand('F'));
document.getElementById('stopBtn').addEventListener('click', () => sendCommand('S'));

```

---

## 3. macOS Setup & Entitlements

On macOS, your app or terminal must have permission to access the Bluetooth antenna.

1. **Terminal/IDE Permission:** If you run your Electron app via `npm start` in Terminal/VS Code, ensure macOS has granted Bluetooth access to that app (**System Settings > Privacy & Security > Bluetooth**).
2. **Packaged App Entitlement:** If building a standalone `.app` bundle, ensure your `Info.plist` file contains:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app requires Bluetooth to connect to the ACEBOTT QD001 car.</string>

```