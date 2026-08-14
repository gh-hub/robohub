# Glossary: acebott-control-app

## ACEBOTT

The manufacturer and brand of a line of robotics kits, including the QD001 smart car and QD002 water gun that the user owns. ACEBOTT also publishes an official companion mobile app called ACEBOTT that controls their kits over Wi-Fi.

## QD001

The ACEBOTT "smart car" kit (v2) the user owns. It is based on an ESP32 microcontroller and includes motors, a servo, an ultrasonic sensor, track sensors, a buzzer, and some firmware variants include a "shoot" pin. This plan's Electron app connects to this car first to enable Wi-Fi-based control from a custom desktop UI.

## QD002

The ACEBOTT "black water gun" kit the user owns. No local documentation for this kit exists in this repository yet (not in `docs/`), and it is explicitly out of scope for this plan. When development reaches the gun, it will be part of a future separate `/gh-dev-workflow` plan. Firmware and control details will be fetched from https://acebott.com/tutorial/ at that time.

## QD005

A different ACEBOTT "Shooting Car" kit. Documentation for this kit exists in this repository's `docs/` folder and was used as a secondary reference during the grill interview to check for Bluetooth/BLE support and understand the ACEBOTT firmware family in general. It is not otherwise part of this plan's scope.

## AP mode (Access Point mode)

The Wi-Fi operating mode the ESP32 car firmware runs in by default. In AP mode, the car itself creates and broadcasts its own Wi-Fi network (SSID `ESP32-Car`) that other devices (like the user's Mac or the ACEBOTT phone app) join to communicate with it, rather than the car joining an existing network.

## STA mode (Station mode)

An alternative Wi-Fi operating mode where the ESP32 would join an existing Wi-Fi network (such as the user's home network) instead of hosting its own access point. This mode was considered during the grill interview (it would allow the Mac to keep internet access while connected) but was rejected in favor of keeping the car in AP mode without firmware changes.

## Binary TCP:100 protocol

The custom binary packet protocol that the official ACEBOTT phone app uses to control the car. Packets are transmitted over a raw TCP socket on port 100. Each packet begins with header bytes `0xFF 0x55`, followed by a length byte and a payload containing action/device/value fields at specific byte indices (action at index 9, device at index 10, value at index 12).

## HTTP:80 protocol

An alternative, simpler example firmware protocol served over plain HTTP on port 80. Movement commands are triggered via GET requests like `GET /Car?move=f` (where `f` = forward, `b` = backward, `l` = left, `r` = right, `s` = stop, `tl` = turn left, `tr` = turn right). This protocol is mutually exclusive with the binary TCP:100 protocol — a car can run one or the other, not both.

## ESP32

The microcontroller (system-on-a-chip) that powers the ACEBOTT QD001 car. It is a Wi-Fi and Bluetooth-capable processor that runs MicroPython firmware in this application. The car's firmware examples in this repository all target the ESP32.

## MicroPython

A lightweight implementation of Python that runs on embedded systems like the ESP32. Both ACEBOTT firmware examples (binary TCP:100 and HTTP:80) are written in MicroPython and provide the car's base control logic and Wi-Fi networking.

