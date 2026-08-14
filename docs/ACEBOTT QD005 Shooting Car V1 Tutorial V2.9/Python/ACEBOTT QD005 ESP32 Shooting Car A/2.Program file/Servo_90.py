import libs.servo

servo_pin = 26
servo = libs.servo.Servo()
servo.attach(servo_pin)

servo.write(90) #initialize servo motor


