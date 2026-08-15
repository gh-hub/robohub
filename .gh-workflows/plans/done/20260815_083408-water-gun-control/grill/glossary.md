# Glossary: water-gun-control

## QD005

ACEBOTT's water gun / water ball launcher attachment for the QD001 car base kit. Adds an aiming servo and a blaster/shoot trigger to the car.

## Aim servo / TURN_SERVO_PIN

The QD005's servo (GPIO 26 on the QA052 shield) that tilts the water gun launcher up/down. Controlled via device code `0x02` in the binary command protocol, absolute angle 1-180.

## Shoot pin / Shoot_PIN

GPIO 32, the QD005's blaster trigger output. Controlled via device code `0x08`; firmware fires a fixed 200ms pulse per command received, ignoring the value byte.

## CMD_RUN

The existing protocol's action byte value `0x01`, used for all direct device commands (lights, movement, and now aim/shoot) — already defined as `CMD_RUN` in `app/src/commandFrame.ts`.

## tcp100

The existing app's name (in `ConnectionState.protocol`) for an active Wi-Fi TCP connection to the car's port-100 binary command socket — the only protocol mode that supports sending any device command.
