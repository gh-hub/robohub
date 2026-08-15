# ACEBOTT QD001 (v2) Smart Car and QD005 Water-Gun Expansion – Technical Overview

**Executive Summary:** The ACEBOTT QD001 (v2) is a 4WD mecanum-wheeled smart robot car kit based on an **ESP32** microcontroller. It supports multiple control modes – **IR remote**, **Wi‑Fi (web/app)**, and smartphone app – with rich expansion options. The QD005 is a “water ball” launcher expansion pack (often called a “water gun” pack) that mounts on the QD001 chassis and adds gel-ball-shooting capability. Both use standard electronics (ESP32 MCU, motor driver circuitry, sensors) and are programmed via USB/Arduino or block-based IDEs. This report collates official specs, wiring/pinouts, protocols (Wi-Fi, IR, etc.), board components (chips, modules), programming guides, and sample code. It also covers firmware updates, pairing, encryption, reverse-engineering hints, troubleshooting, safety, and legal notes. Where official documentation is lacking, we note it explicitly.

## Product Overviews

- **QD001 Smart Car (v2)** – A 4WD mecanum-wheel robot car kit for ESP32 (Arduino-compatible). Key features include 360° omnidirectional drive, line‐tracking sensors, ultrasonic obstacle avoidance, and multi-mode remote control (IR, Wi‑Fi **&** smartphone app). It includes an ESP32-based controller board (ESP32-Max-V1.0) and a motor-driver “Car Shield” (QA052) with 5 DC motor ports, 3 servos, I²C, etc.. The kit supports 6–18V battery input via onboard regulator. Version 2 (v2) adds a pre-installed firmware, printed manual, and independent motor control (all features in the latest kit release).

- **QD005 Water Launcher (Black)** – An expansion pack (for QD001 chassis) that adds a **water-ball launcher** mechanism (gel “soft ammo” blaster) and a scope. It includes the launcher assembly, a motorized firing mechanism, and connector wires (the ESP32 controller and motors are powered by the base car). It comes with safety goggles and plugs into the car’s expansion interfaces. The QD005 has **no standalone wireless module**; it is driven by the QD001’s ESP32. (The “black” version likely refers to chassis color; functionally identical to standard QD005.) 

**Specs (summarized):** 4WD mecanum car, ESP32 MCU (240 MHz dual-core, 520 KB SRAM, 4 MB flash), up to 5V–15V supply (max 15 V in, 3 A outputs), built-in Wi‑Fi (2.4 GHz b/g/n) and Bluetooth 4.2, USB-C programming/Serial interface, 5 motor channels (M1–M5 on shield), 3 servo ports, ultrasonic sensor port, line-tracking port, etc. QD001 supports remote control via an IR receiver (38 kHz IR module) and via a smartphone app connecting over Wi‑Fi. The expansion QD005 adds a DC motor-driven gel blaster to the platform; it draws power from the car’s battery and control signals from the ESP32.

## Official Documentation & Resources

- **Manufacturer Wiki & Manuals:** ACEBOTT provides a detailed [Wiki page for QD001](https://acebott.com/docs/qd001-smart-car-starter-kit-for-esp32/) (Explorer Series). It covers assembly, tutorial links, and features (IR/WiFi/App control). The [Car Shield (QA052)](https://acebott.com/docs/qa052-esp32-car-shield-v1-0/) and [ESP32-Max V1.0 controller board](https://acebott.com/docs/qa007-qa008-qa009-esp32-max-v1-0-controller-board/) pages describe hardware specs and wiring. Assembly videos (including QD005) are on the ACEBOTT site under **Assembly Videos**. ACEBOTT also supplies sample code (Arduino/C++) and block-code (ACECode), though source links (PDF/Dropbox) often require their site navigation. 

- **Vendor Datasheets:** The ESP32 WROOM-32 datasheet covers the main MCU features (240 MHz Tensilica CPU, Wi‑Fi/BLE radio, ADC/DAC, SPI/I2C/UART). The IR receiver (model QB073) specs are given by ACEBOTT (38 kHz carrier, 15 m range, digital output at 3.3–5 V). Sensor modules like HC-SR04 ultrasonic or QB060 line sensors follow standard specs (e.g. 3–5 V, 2.5 cm–4 m range). The motor modules (TT motors, ~6V gear motors) and servos (SG90) are common hobby parts.

- **FCC / Compliance:** No specific FCC ID for QD001/QD005 was found; the products use the ESP32 (FCC-certified as part of the module) and operate on standard 2.4 GHz Wi‑Fi. Makers should ensure local regulatory compliance (CE/FCC) if deploying. 

- **Teardowns & Community:** We found no dedicated teardown in English. However, the kit is similar to other ESP32 robot kits; likely using a 74HC595 shift register and H-bridge drivers to run motors. See **Table: Chips & Components** below. 

## Hardware Architecture

### Main Controller (ESP32 Board)

The QD001 uses the **ESP32-Max V1.0** board (a custom ESP32 dev board). Key specs from ACEBOTT:

- **MCU:** ESP32-WROOM-32 (dual-core Xtensa LX6 @240 MHz, built-in Wi-Fi 2.4 GHz 802.11b/g/n and Bluetooth 4.2/BLE).
- **Memory:** 520 KB SRAM, 448 KB ROM, 4 MB external flash.
- **Interfaces:** 34 GPIOs (25 digital, 15 ADC, 2 DAC, 2 UART, 2 SPI, 1 I²C as default). (Default I²C pins: GPIO21=SDA, 22=SCL.)
- **Power:** 6–18 V input (via DC jack or battery pack). On-board regulator (Capable of up to 15 V input). Onboard **USB-C port** (CP2102/CH340 USB‑UART chip) for programming and power.
- **USB‐Serial:** Implements CP2102 or CH340 converter (drivers listed on ACEBOTT site) to connect to PC for Arduino IDE programming. 
- **Bootloader:** Stock Espressif ROM bootloader (flashing via USB).
- **Onboard Indicators:** Likely a power LED (red) and status LED.
- **Programming:** Compatible with Arduino IDE, ESP-IDF, MicroPython/Thonny, and ACEBOTT’s block IDE (ACECode). Acebott provides Arduino libraries to control motors, sensors, camera, etc.

### Car Shield (QA052 Expansion)

The **Car Shield V1.0** plugs onto the ESP32 controller (via dual-row headers) and provides motor drivers, sensors, and power distribution. Features:

- **Motor Outputs:** 5 DC motor connectors (M1–M5), each a 3-pin header (DC+6V, GND, control).
- **Servo Outputs:** 3 standard 3-pin servo ports.
- **Sensors:** Built-in ultrasonic rangefinder port (HC-SR04 style, 4-pin) and a 3-channel line-tracking sensor port.
- **I²C Bus:** Three-pin I²C header (5 V, GND, SDA, SCL) for external I²C modules (e.g. compass, OLED).
- **Digital/Analog Pins:** Three 3-pin headers as “digital” GPIOs and two 3-pin “analog” headers.
- **Power:** A main power terminal (up to 15 V, 3 A). The motor outputs can handle 3 A each. 
- **Level Shifters & Drivers:** Internally, the shield uses a 74HC595 shift register to serially set motor directions and an H-bridge driver (e.g. L298N or similar) for PWM speed. (Exact IC not documented, but the Arduino sample uses `shiftOut` plus a PWM pin for each motor.) 
- **Wiring Diagram:** ACEBOTT docs include wiring diagrams (e.g. connecting a TT motor to M1 in the “Case Example”).

### Sensors and Modules

- **Infrared Receiver (for IR remote):** The car kit includes an IR sensor module (QB073). It operates at 38 kHz, outputs a digital code on receipt. Wiring: VCC to 5 V, GND, and signal to ESP32 GPIO (e.g. GPIO32). ACEBOTT sample code reads IR codes with the IRremote library.
- **Ultrasonic Sensor:** Standard HC-SR04 (QB042) plugged into the shield’s ultrasonic port. Distance feedback for obstacle avoidance.
- **Line-Tracking:** A 3-element IR reflectance array (QB060 series) plugs into the “three-way Trace sensor interface”. Likely provides analog or digital line detection.
- **Motors:** Four TT gear DC motors (6 V) driving the mecanum wheels.
- **Servos:** Used only if expansion (e.g. QD007 arm). QD001 kit itself has no servo load by default.
- **Battery:** Typically a 7.4 V Li-ion pack (2S LiPo, >1000 mAh) powers the car via the DC jack. (ACEBOTT’s documentation doesn’t specify, but standard robot kits use Li-ion or AA battery pack.)
- **QD005 Mechanism:** The water-ball launcher uses one or two small DC gear motors to spin and fire gel balls (plus a gravity-fed hopper). It likely includes an internal **H-bridge or transistor board** to drive the motors. According to a seller, the QD005 “connects the control wires to designated ESP32 GPIO headers” on the car. In practice, the launcher’s motor power comes directly from the car’s battery, and the ESP32 toggles a GPIO or servo output to activate the launcher. (Exact schematic is not publicly documented.)

**Table – Chips & Modules:** Overview of major components and their roles.

| Component               | Role / Description                                          | Source / Datasheet                                      |
|-------------------------|-------------------------------------------------------------|---------------------------------------------------------|
| **ESP32-WROOM-32**      | Main MCU: dual-core 240 MHz CPU, Wi‑Fi/Bluetooth radio. 520 KB SRAM, 4 MB flash. Handles all logic and communications. | (Espressif datasheet)                                     |
| **CP2102 (USB-UART)**   | USB‑Serial bridge for programming/debugging (requires driver). | (Silicon Labs CP2102)                                    |
| **CH340G (USB-UART)**   | Alternate USB‑Serial chip (driver download provided). | (WCH CH340G datasheet)                                   |
| **74HC595** (likely)    | Shift-register (8-bit) for serial motor control (speculated). | NXP 74HC595 datasheet (if used)                         |
| **H-Bridge Driver**     | DC motor driver IC(s) (e.g. L298N or TB6612) on Car Shield to power motors. | Typical L298N/TB6612TWS datasheet (if used)             |
| **TPS/PWR MOSFETs** (possible) | Power switching (if no H-bridge IC). | –                                                       |
| **QB073 IR Receiver**   | IR demodulator module (38 kHz). Receives IR remote signals. | ACEBOTT IR module specs                 |
| **HC-SR04 (Ultrasonic)**| Ultrasonic distance sensor (4-pin). Common spec (2.5–4 m range). | (See HC-SR04 datasheet)                                 |
| **QB060 3-Channel Line Sensor** | Infrared reflectance array (analog outputs for black/white line). | (ACEBOTT sensor module spec)                            |
| **Battery (7.4 V Li‑ion)** | Power source for car (onboard battery). Typically 2S Li-ion 7.4 V. | –                                                       |
| **QD005 Blaster Motor(s)** | DC gear motor(s) for launching ammo. Connected via control board to ESP32 GPIO. | –                                                       |
| **Misc Modules:** LEDs (status), passive components, connectors, etc. | – | – |

*(Entries without official datasheets indicate common modules. “Speculated” notes indicate no official published info.)*

## Connectivity & Protocols

- **Wi‑Fi (2.4 GHz)**: The ESP32 runs in **AP mode** for app control. By default, sample “App Control” firmware sets up an SSID like **“ESP32-CAR”** with password **12345678** (similarly “ESP32-CAM” for camera kits). A smartphone or computer connects to this network. The ACEBOTT app then communicates via HTTP or WebSocket to the ESP32 server (typically at 192.168.4.1). (The exact API is proprietary, but commands likely trigger motor/servo actions.) The car can also be programmed in STA mode to join a home router, enabling Internet-of-Things control, but the usual educational use is peer-to-peer.

- **IR (Infrared Remote)**: A standard IR remote uses a 38 kHz modulated signal to send hex codes. The car kit includes an IR receiver (demodulator) that outputs received codes to the ESP32. ACEBOTT’s Arduino example uses the IRremote library to decode button presses into HEX codes. Control via IR is one-way (no pairing required); any ACEBOTT remote or compatible TV remote can send the signal. No encryption – just raw pulse codes.

- **Bluetooth:** The ESP32 is capable of Bluetooth, but QD001 does not use it directly. Instead, ACEBOTT sells an **ACEBOTT QD010 Bluetooth Handle Controller** (not part of this query) that can drive the car via Bluetooth. If that is used, the car runs special firmware to accept Bluetooth commands. (By default, car’s “App Control” is via Wi-Fi, not BLE.)

- **Serial/UART:** The microcontroller’s USB port (USB‑UART) provides a virtual COM port. With a USB-C cable attached, you can issue AT/serial commands or upload firmware. The board also has two hardware UARTs (TX/RX pins) free; these could be used by advanced users (e.g. GPS on UART, or micro:bit, etc.).

- **Other Buses:** The Car Shield exposes an I²C header (VCC/GND/SDA/SCL). If a module like QD002 (camera) or QD009 (GPS) is attached, it may use I²C or SPI. The ESP32-Max board has SPI pins (for SD card or displays), one I²C, one CAN bus (unused in QD001), etc. The shift register (74HC595) and H-bridge use SPI-like signaling from the microcontroller (implemented via digital pins and `shiftOut`).  

- **Wireless Protocols:** The Wi-Fi AP is typically unencrypted (open or WPA2-PSK with the given password). No custom encryption layer is documented; data is likely sent in plaintext (HTTP). The IR remote uses NEC or RC5 style codes (not encrypted). There is no pairing procedure beyond connecting to the Wi-Fi network (entering the known password on the phone).

**Protocol Table:**  

| Interface   | Details & Usage                                |
|-------------|------------------------------------------------|
| **Wi‑Fi (2.4 GHz b/g/n)** | ESP32 hosts an Access Point (“ESP32-CAR”, PW=12345678) or STA. Used by Acebott app and Web controller. Standard IP/TCP (HTTP/WebSocket) commands control motors/camera. |
| **IR (38 kHz)** | IR demodulator (QB073) receives remote codes. Uncoded (data visible) protocol (e.g. NEC format). No pairing: press remote keys to send commands. |
| **Bluetooth (BLE 4.2)** | Not used by QD001 by default. Optional QD010 handle uses Bluetooth for driving. |
| **USB‑Serial (UART)** | CP2102/CH340 provides TTL-UART over USB. Used for programming/flashing via Arduino IDE. Also available for serial debugging at 115200 bps. |
| **PWM / Digital I/O** | Car Shield provides PWM output for motors, digital outs for servos. QD005 blaster likely triggered by a GPIO or servo command. |
| **I²C** | Unused by base car; available for I²C sensors (e.g. QD009 GPS uses UART though). |
| **SPI** | Internally used for shift register on Car Shield. Also available for SD card (ESP32 SD2) or QD002 camera bus. |
| **Other** | ADC (for analog sensors, e.g. line tracking), DAC (ESP32 pins), CAN (ESP32 has CAN, not used by default). |

## Pinouts & Wiring

- **ESP32 Controller Pinout:** All GPIOs are broken out on the Max board. Important pins: GPIO2 (LED_BUILTIN), GPIO32 (IR receiver signal, per example), GPIO18/19/5 (used as SCLK/MOSI/MISO for shift register), GPIO16/17 (control pins for motor driver latch). The USB-C port provides 5 V; an external battery (6–15 V) is supplied via the Car Shield power input.

- **Car Shield Connections:** Motors plug into M1–M5 (three-pin plug: +6V, GND, PWM/Dir). Ultrasonic uses 4-pin (Vcc, Trig, Echo, GND). The three-line-tracking sensors plug into the 3-pin channel (Vcc, GND, output). Servos plug into the servo ports (5 V, GND, signal). The I²C header has 5 V, GND, SDA, SCL.

- **QD005 Launcher Wiring:** The expansion pack attaches to the front of the chassis. Two (or more) wires from the launcher (ground, VCC, and control) plug into the Car Shield’s spare ports. According to a distributor, you “connect the control wires to the designated ESP32 GPIO headers”. In practice, one wire goes to 5 V (or battery+), one to GND, and one to a PWM-capable GPIO (or servo output) on the shield. (Acebott’s example suggests adding a “launcher routine” in code once wires are connected.) No soldering is required – the kit uses snap-on connectors.

- **Pin Usage Table (Examples):** 

  | Function               | Board Pin      |
  |------------------------|----------------|
  | IR Receiver Signal     | GPIO32 (default)  |
  | Motor Driver Latch (STCP) | GPIO17    |
  | Motor Driver Clock (SHCP)| GPIO18    |
  | Motor Driver Data      | GPIO5     |
  | Motor PWM Out (M1–M4)  | GPIO19 (PWM1), etc. |
  | Servo Port #1 Signal   | (any GPIO, often 15)      |
  | Ultrasonic Trig/Echo   | (Shield header)           |
  | QD005 Launcher Control | (e.g. Servo/ PWM port)    |

*(Exact pins for M2–M4, servos can be assigned in code.)*

- **Power:** The ESP32 board can be powered by USB (5 V) or external battery via shield. The shields’ “power interface” supplies 6–15 V to onboard regulator. The car’s battery should match this range (commonly 7.4 V Li-ion). The Car Shield shares 5 V rail for motors (with step-down). Always power off before plugging expansions.

## Programming & Software

- **Development Environments:** ACEBOTT supports Arduino IDE and its own **ACECode** (a Scratch-like blocks tool). ESP32 is programmed like any Arduino board (select “ESP32 Dev Module” and COM port in the IDE). Install CP2102/CH340 drivers first.

- **Libraries:** ACEBOTT provides Arduino libraries for controlling the car (motors, servos, sensors, LED) and QD series. Code examples (C/C++) are in their [Dropbox](#) or IDE bundle. For instance, a sample motor control sketch (from Car Shield docs) shows setting up pins and using `shiftOut()` and `analogWrite()` to drive a motor.

- **Flashing Firmware:** Use USB-C cable. In Arduino IDE, open example sketches (e.g. “ESP32 Smart Car – App Control”). The Wiki suggests first uploading a “App Control” sketch for mobile use. Then, reboot car, connect phone to “ESP32-CAR” Wi-Fi (password `12345678`), and open Acebott app.

- **Mobile App & Web Control:** The official **ACEBOTT Robot App** (Android/iOS) communicates with the car over Wi-Fi. It likely sends HTTP GET/POST requests or uses WebSockets. (Exact API is not publicly documented.) Users can also control via a browser by navigating to `192.168.4.1` after connecting to the car’s hotspot (some kits may host a simple web page).

- **Sample Code Snippets:** While no official API is released, one can replicate control by sending network requests to the ESP32. *For example*, a Python script could send an HTTP command (method dependent on firmware) to move the car. The following pseudocode illustrates the approach:

  ```python
  import requests
  # Example: send a “move forward” command to ESP32
  ip = "192.168.4.1"   # default IP of ESP32 AP
  cmd = "/move?dir=forward&speed=100"
  response = requests.get(f"http://{ip}{cmd}")
  print(response.text)
  ```

  Similarly, in **Node.js** (JavaScript):  
  ```javascript
  const axios = require('axios');
  axios.get('http://192.168.4.1/move?dir=forward&speed=100')
    .then(res => console.log(res.data));
  ```

  In **Android (Kotlin)**, one might use an `AsyncTask` or coroutines to hit the same URL:  
  ```kotlin
  val url = URL("http://192.168.4.1/move?dir=left&speed=80")
  val conn = url.openConnection() as HttpURLConnection
  conn.requestMethod = "GET"
  val response = conn.inputStream.bufferedReader().readText()
  println(response)
  ```

  In **iOS (Swift)**:  
  ```swift
  let url = URL(string: "http://192.168.4.1/move?dir=right&speed=60")!
  let task = URLSession.shared.dataTask(with: url) { data, _, _ in
      if let data = data, let resp = String(data: data, encoding: .utf8) {
          print(resp)
      }
  }
  task.resume()
  ```

  In **Flutter (Dart)**:  
  ```dart
  import 'package:http/http.dart' as http;
  var res = await http.get(Uri.parse("http://192.168.4.1/move?dir=stop"));
  print(res.body);
  ```

  In **React Native (JavaScript)**:  
  ```javascript
  fetch("http://192.168.4.1/move?dir=backward")
    .then(response => response.text())
    .then(text => console.log(text));
  ```
  *Note: The actual command strings (`/move?dir=...`) are illustrative; you must discover or derive the real endpoints from the Acebott firmware (e.g. by sniffing the app or consulting ACECode blocks).*

- **Pairing:** There is no Bluetooth pairing for app use; just join the Wi-Fi SSID `ESP32-CAR` (password `12345678`). For IR remote, no pairing; just press buttons after powering the car.

## Bootloader & Firmware Updates

- **USB Flashing:** Install the CP2102 (or CH340) USB driver on your PC (ACEBOTT provides links). In Arduino IDE, select “ESP32 Dev Module” and the correct COM port. Press the **Boot** button on ESP32 (if needed) to enter flash mode (some ACEBOTT boards auto-reset). Then upload the compiled sketch.

- **OTA Updates:** Not officially documented. One could implement ESP32 OTA (Arduino OTA or HTTP OTA) by including relevant libraries, but ACEBOTT’s supplied firmware likely uses basic USB. For recovery, always keep a USB cable handy.

- **Bootloader:** The default Espressif ROM bootloader is on the ESP32 and cannot be changed without soldering. ACEBOTT uses this bootloader for flashing.

- **Firmware Backup:** Advanced users can use **esptool.py** (over USB UART) to read the flash contents for backup. This requires holding GPIO0 low at reset to allow flash reading.

## Encryption & Authentication

- **Wi-Fi Security:** The car’s hotspot uses WPA2-PSK with a default password (12345678). This is easily changed by editing the source code in Arduino (`WiFi.softAP(ssid, password)`). Ensure the password is secure to prevent unauthorized control. No additional TLS/SSL encryption is provided by default; communications are over plain HTTP/TCP.

- **IR Remote:** No security. Any compatible IR remote or controller can trigger the car if within line-of-sight. The IR protocol is fixed (38 kHz, likely NEC-based); codes can be read by the IRrecv example and replicated.

- **Bluetooth (QD010, optional):** If using the Bluetooth handle (QD010), that would involve standard BLE pairing (not detailed here).

- **Proprietary Protocols:** The smartphone app’s protocol is proprietary and undocumented. It likely does not use strong encryption. If reverse-engineering, treat it as you would any IoT device: intercept network traffic or decompile the app.

## Reverse Engineering Notes

- **IR Codes:** Use the Arduino `IRremote` library on the ESP32 to capture IR remote codes. Once captured, you can hard-code those codes in your sketch to perform actions.

- **Network Traffic:** To discover control endpoints, put your phone on a PC with Wi-Fi packet capture or run a local proxy (on Android, via Packet Capture app with local VPN). Observe the REST or WebSocket calls made by the Acebott app to the car’s IP. This will reveal command formats (e.g. `/move?`, `/servo?`, `/shoot?`).

- **Hardware Hacking:** If hardware modifications are needed (e.g. using the ESP32 in a custom mount), note that all pins are exposed. You could connect additional sensors or LEDs. The Car Shield and ESP32 board are not open-source hardware, so PCB layouts and exact chip markings must be determined by physical inspection or asking ACEBOTT.

- **Firmware:** The ESP32 runs Arduino code which could be downloaded (over USB) and inspected. If the code size is small (<512 KB), you could use esptool to dump the flash (in bootloader mode) and attempt to disassemble. However, this is beyond the usual STEM use and may conflict with license terms (see Legal).

## Troubleshooting & Tips

- **Connectivity Issues:** If the phone app says “Not connected”, ensure the car is powered on, then connect your phone’s Wi-Fi to **ESP32-CAR** (or similar SSID) with password **12345678**. Then reopen the app. A reset/upload of the “App Control” sketch often resolves connection problems.

- **Power Problems:** Use a fresh battery or USB power. The motors can draw significant current; ensure the battery is charged and capable of >3 A. The onboard voltage regulators may heat up under load.

- **Coding Errors:** Enable the Arduino Serial Monitor at 115200 baud to view debug prints. Print statements in your code can help diagnose sensor readings or state changes.

- **IR Remote Issues:** Ensure the IR receiver’s notch faces the user (don’t block it). Test one button and watch the Serial Monitor for a code. If codes don’t appear, check wiring: VCC to 5 V, GND to ground, SIG to GPIO (32).

- **Charging (if Li-ion):** If your kit uses a Lithium battery, charge it with a proper 7.4 V charger. The ACEBOTT kit may include a charging module (QB102); if so, it likely has a micro-USB or DC input and LED indicators.

- **Firmware Erase:** To fully reset, you can erase flash via esptool:  
  ```
  esptool.py --port COM8 erase_flash
  ```
  Then re-upload code.

## Legal & Safety

- **Safety:** The QD005 shoots water-gel balls. These can mark or irritate eyes; always wear the provided goggles and do not aim at faces. Ensure the workspace is safe for running robots (no water hazards, stable floor). Keep hair and loose clothing clear of moving wheels/launchers. Adult supervision is advised for young users. The electronics are low-voltage but can get warm; allow motors to cool if overheating.

- **FCC/CE Compliance:** As a consumer STEM kit, the QD001 should comply with regional regulations for wireless devices. The ESP32 module is pre-certified for Wi-Fi/Bluetooth. Users hacking the device should maintain compliance (e.g. do not modify RF settings outside allowed bands).

- **Intellectual Property:** ACEBOTT retains trademark on “ACEBOTT” and product names. The hardware design and firmware are proprietary. However, the ESP32 platform and Arduino ecosystem are open. You may program and modify the kit for personal or educational use. Distribution of modified firmware should respect ACEBOTT’s terms (if any) and not misuse their branding. The ACECODE software (block editor) appears to be provided free for learning. Use of code libraries (ESP32 Arduino core, IRremote, etc.) should comply with their open-source licenses.

- **Reverse-Engineering:** Generally, reverse-engineering for interoperability is allowed in many jurisdictions, but check local laws. Do not plagiarize ACEBOTT’s copyrighted materials (manuals, videos).

## Summary of Interfaces

| Interface   | Chip/Module         | Description                             |
|-------------|---------------------|-----------------------------------------|
| Wi-Fi (AP)  | ESP32-WROOM-32      | Hosts Wi-Fi network (“ESP32-CAR”) for smartphone control. |
| Bluetooth   | ESP32 module        | (Not used by default; possible with QD010 controller) |
| IR          | QB073 Receiver      | 38 kHz IR demodulator. Receives remote control codes. |
| USB-UART    | CP2102 / CH340      | USB interface for programming (UART signals). Drivers from ACEBOTT site. |
| Motor Drive | Car Shield (H-bridge) | Drives 4 DC motors (M1–M4); uses PWM + shift register. |
| Servo Drive | Car Shield (PWM)    | PWM outputs for up to 3 servos.        |
| Sensors     | Car Shield headers  | Ultrasonic (HC-SR04), line sensors, etc. Analog/Digital from ESP32. |
| QD005 Gun   | (custom board)      | DC motor(s) for gel-blaster; controlled via Car Shield port (likely servo/PWM). |
| Power       | Onboard regulators  | Vin (6–15 V), onboard 5 V/3.3 V rails. Battery required. |

## Diagrams

```mermaid
flowchart LR
    subgraph Smartphone
        A[Phone App] -- Wi-Fi --> B((ESP32 AP))
    end
    subgraph "ACEBOTT QD001 Car (ESP32 Controller)"
        B --> C[ESP32 MC P]
        C --> D[Car Shield Motor Drivers]
        C --> E[IR Receiver Module]
        C --> F[Ultrasonic Sensor]
        C --> G[Line Sensor Array]
        C --> H[QD005 Blaster (via GPIO)]
    end
    D --> I[Mecanum Wheels (4× DC)]
    H --> J[Water-Gel Launcher Motor]
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#dfd,stroke:#333,stroke-width:2px
    style D fill:#ffd,stroke:#333,stroke-width:2px
```

This flowchart shows the high-level connectivity: the phone app connects over Wi-Fi to the ESP32 in the car, which in turn drives motors and sensors. The QD005 blaster is also controlled by the ESP32’s GPIOs.

**Sources:** Official ACEBOTT documentation and product pages, supported by reseller datasheets and community tutorials. Where detailed info (e.g. internal schematics) is not available, we have inferred from sample code and analogous designs, noting lack of published data. All relevant links are cited above for reference. 

