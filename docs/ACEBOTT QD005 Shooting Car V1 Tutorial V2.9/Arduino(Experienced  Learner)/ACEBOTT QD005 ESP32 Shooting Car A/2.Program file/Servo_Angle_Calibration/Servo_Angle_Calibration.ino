#include <ESP32Servo.h>

#define TURN_SERVO_PIN 26
Servo turnServo;   //create servo object to control a servo

void setup() {
  turnServo.attach(TURN_SERVO_PIN); //attaches the servo on 26 to the servo object
  turnServo.write(90); //Turn the servo to 90° as the initial Angle
}

void loop() {

  }
