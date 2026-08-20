# Glossary: car-log-viewer

## TCP:100
The car firmware's binary command-protocol port (`WiFiServer(100)`), framed with a `0xFF 0x55` header; this is the socket `CarConnection` in `app/src/carConnection.ts` holds open for the "connected, protocol: tcp100" session state.

## HTTP:80
The car firmware's alternate control channel (`GET /control?var=car&val=...`); has no persistent connection, so nothing can be streamed/pushed from it the way TCP:100 allows.

## CH340
The USB-to-serial adapter chip used on this car's ESP32 board. Confirmed identity: Vendor ID `0x1A86`, Product ID `0x7523` (QinHeng Electronics).

## `sendToClient()`
An existing method on the firmware's `ACB_CAR_ARM` class that writes arbitrary text back over an already-open TCP:100 client socket. Currently only invoked with two hardcoded strings on servo-limit events; not (yet) used for general logging by any firmware this plan touches.

## `Carloop()`
The firmware method that must run every `loop()` iteration to pump the TCP:100 client socket and parse incoming command frames. Not called in the user's example sketch — noted as a pre-existing, out-of-scope issue.

## `serialport`
The npm package this plan adds to `app/` for real, cross-platform (Windows/macOS) serial port enumeration (`SerialPort.list()`) and I/O (open/read/close) from the Electron main process.
