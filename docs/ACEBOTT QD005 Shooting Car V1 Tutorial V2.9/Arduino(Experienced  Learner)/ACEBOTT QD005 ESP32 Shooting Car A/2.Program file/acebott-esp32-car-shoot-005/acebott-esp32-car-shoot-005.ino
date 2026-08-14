#include <WiFi.h>
#include "esp_camera.h"
#include <vehicle.h>
#include <ultrasonic.h>
#include <ESP32Servo.h>
#include <Arduino.h>

#define Shoot_PIN 32  //shoot---200ms
#define FIXED_SERVO_PIN 25  //Non-adjustable servo pins
#define TURN_SERVO_PIN 26  //Adjustable servo pin

#define LED_Module1 2
#define LED_Module2 12
#define Left_sensor 35
#define Middle_sensor 36
#define Right_sensor 39
#define Buzzer 33

#define CMD_RUN 1
#define CMD_GET 2
#define CMD_STANDBY 3
#define CMD_TRACK_1 4
#define CMD_TRACK_2 5
#define CMD_AVOID 6
#define CMD_FOLLOW 7

//app music
#define C3 131
#define D3 147
#define E3 165
#define F3 175
#define G3 196
#define A3 221
#define B3 248

#define C4 262
#define D4 294
#define E4 330
#define F4 350
#define G4 393
#define A4 441
#define B4 495

#define C5 525
#define D5 589
#define E5 661
#define F5 700
#define G5 786
#define A5 882
#define B5 990
#define N 0

const char *ssid = "ESP32-Car";     //Set WIFI name
const char *password = "12345678";  //Set WIFI password
WiFiServer server(100);             //Set server port
WiFiClient client;                  //client

vehicle Acebott;        //car
ultrasonic Ultrasonic;  //ultrasonic
Servo fixedServo;           //Servo
Servo turnServo;           //shooting servo


int Left_Tra_Value;
int Middle_Tra_Value;
int Right_Tra_Value;
int Black_Line = 2000;
int Off_Road = 4000;
int speeds = 250;
int leftDistance = 0;
int middleDistance = 0;
int rightDistance = 0;

String sendBuff;
String Version = "Firmware Version is 0.12.21";
byte dataLen, index_a = 0;
char buffer[52];
unsigned char prevc = 0;
bool isStart = false;
bool ED_client = true;
bool WA_en = false;
byte RX_package[17] = { 0 };
uint16_t angle = 90;
byte action = Stop, device;
byte val = 0;
char model_var = 0;
int UT_distance = 0;

int length0;
int length1;
int length2;
int length3;
/*****app music*****/
// littel star
int tune0[] = { C4, N, C4, G4, N, G4, A4, N, A4, G4, N, F4, N, F4, E4, N, E4, D4, N, D4, C4 };
float durt0[] = { 0.99, 0.01, 1, 0.99, 0.01, 1, 0.99, 0.01, 1, 1.95, 0.05, 0.99, 0.01, 1, 0.99, 0.01, 1, 0.99, 0.01, 1, 2 };
// jingle bell
int tune1[] = { E4, N, E4, N, E4, N, E4, N, E4, N, E4, N, E4, G4, C4, D4, E4 };
float durt1[] = { 0.49, 0.01, 0.49, 0.01, 0.99, 0.01, 0.49, 0.01, 0.49, 0.01, 0.99, 0.01, 0.5, 0.5, 0.75, 0.25, 1, 2 };
// happy new year
int tune2[] = { C5, N, C5, N, C5, G4, E5, N, E5, N, E5, C5, N, C5, E5, G5, N, G5, F5, E5, D5, N };
float durt2[] = { 0.49, 0.01, 0.49, 0.01, 1, 1, 0.49, 0.01, 0.49, 0.01, 1, 0.99, 0.01, 0.5, 0.5, 0.99, 0.01, 1, 0.5, 0.5, 1, 1 };
// have a farm
int tune3[] = { C4, N, C4, N, C4, G3, A3, N, A3, G3, E4, N, E4, D4, N, D4, C4 };
float durt3[] = { 0.99, 0.01, 0.99, 0.01, 1, 1, 0.99, 0.01, 1, 2, 0.99, 0.01, 1, 0.99, 0.01, 1, 1 };
/*****app music*****/

unsigned char readBuffer(int index_r) {
  return buffer[index_r];
}
void writeBuffer(int index_w, unsigned char c) {
  buffer[index_w] = c;
}

enum FUNCTION_MODE {
  STANDBY,
  FOLLOW,
  TRACK_1,
  TRACK_2,
  AVOID,
} function_mode;

void setup() {
  Serial.setTimeout(10);  // Set the serial port timeout to 10 milliseconds
  Serial.begin(115200);   // Initialize serial communication, baud rate is 115200

  Acebott.Init();     // Initialize Acebott
  Ultrasonic.Init(13,14);  // Initialize the Ultrasonic Module

  pinMode(LED_Module1, OUTPUT);  // Set  LED module1 as output
  pinMode(LED_Module2, OUTPUT);  // Set  LED module2 as output
  pinMode(Shoot_PIN, OUTPUT);    // Set shooting pin as output
  pinMode(Left_sensor, INPUT);     // Set the infrared left line pin as input
  pinMode(Middle_sensor, INPUT);   // Set the infrared middle line pin as input
  pinMode(Right_sensor, INPUT);    // Set the infrared right line pin as input

  ESP32PWM::allocateTimer(1);  // Assign timer 1 to ESP32PWM library
  fixedServo.attach(FIXED_SERVO_PIN);   // Connect the servo to the FIXED_SERVO_PIN pin
  fixedServo.write(angle);         // Set the servo angle to angle
  turnServo.attach(TURN_SERVO_PIN);   // Connect the servo to the TURN_SERVO_PIN pin
  turnServo.write(angle);         // Set the servo angle to angle
  Acebott.Move(Stop, 0);       // Stop Acebott Movement
  delay(3000);                 // Delay 3 seconds

  length0 = sizeof(tune0) / sizeof(tune0[0]);  // Calculate the length of tune0 array
  length1 = sizeof(tune1) / sizeof(tune1[0]);  // Calculate the length of tune1 array
  length2 = sizeof(tune2) / sizeof(tune2[0]);  // Calculate the length of tune2 array
  length3 = sizeof(tune3) / sizeof(tune3[0]);  // Calculate the length of tune3 array

  WiFi.setTxPower(WIFI_POWER_19_5dBm);  // Set Wi-Fi transmit power to 19.5dBm
  WiFi.mode(WIFI_AP);                   // Set Wi-Fi working mode to access point mode
  WiFi.softAP(ssid, password, 5);       // Create a Wi-Fi access point, the SSID is ssid, the password is password, and the maximum number of connections is 5
  Serial.print("\r\n");
  Serial.print("Camera Ready! Use 'http://");  // Print prompt message
  Serial.print(WiFi.softAPIP());               // Print access point IP address
  Serial.println("' to connect");              // Print prompt message

  delay(100);
  server.begin();  // 启动服务器
  delay(1000);
}

void loop() {
  RXpack_func();
  //model4_func();
}

void functionMode() {
  switch (function_mode) {
    case FOLLOW:
      {
        model3_func();  // Enter the follow mode and call the model3_func() function
      }
      break;
    case TRACK_1:
      {
        model1_func();  // Enter tracking mode 1 and call the model1_func() function
      }
      break;
    case TRACK_2:
      {
        model4_func();  // Enter tracking mode 2 and call the model4_func() function
      }
      break;
    case AVOID:
      {
        model2_func();  // Enter obstacle avoidance mode and call the model2_func() function
      }
      break;
    default:
      break;
  }
}

void Receive_data()  // Receive data
{
  if (client.available())  // If data is available
  {
    unsigned char c = client.read() & 0xff;  // Read one byte of data
    Serial.write(c);                         // Send received data on serial port
    if (c == 0x55 && isStart == false)       // If start flag 0x55 is received and data reception has not started yet
    {
      if (prevc == 0xff)  // If the previous byte is also the start flag 0xff
      {
        index_a = 1;     // Data index is set to 1
        isStart = true;  // Start receiving data
      }
    } else {
      prevc = c;    // Update the value of the previous byte
      if (isStart)  // If you have started receiving data
      {
        if (index_a == 2)  // If it is the second byte, it indicates the data length
        {
          dataLen = c;           // Update data length
        } else if (index_a > 2)  // If it is the subsequent byte
        {
          dataLen--;  // Data length minus one
        }
        writeBuffer(index_a, c);  // Write data to buffer
      }
    }
    index_a++;          // Index increase
    if (index_a > 120)  // If the index exceeds the upper limit
    {
      index_a = 0;      // reset index to 0
      isStart = false;  // End data reception
    }
    if (isStart && dataLen == 0 && index_a > 3)  // If data reception is completed
    {
      isStart = false;  // End data reception
      parseData();      // Analytical data
      index_a = 0;      // reset index to 0
    }
  }
}

void model2_func()  // OA
{
  fixedServo.write(90);
  UT_distance = Ultrasonic.Ranging();
  //Serial.print("UT_distance:  ");
  //Serial.println(UT_distance);
  middleDistance = UT_distance;

  if (middleDistance <= 25) {
    Acebott.Move(Stop, 0);
    for (int i = 0; i < 500; i++) {
      delay(1);
      Receive_data();
      if (function_mode != AVOID)
        return;
    }
    fixedServo.write(45);
    for (int i = 0; i < 300; i++) {
      delay(1);
      Receive_data();
      if (function_mode != AVOID)
        return;
    }
    rightDistance = Ultrasonic.Ranging();
    //Serial.print("rightDistance:  ");
    //Serial.println(rightDistance);
    fixedServo.write(135);
    for (int i = 0; i < 300; i++) {
      delay(1);
      Receive_data();
      if (function_mode != AVOID)
        return;
    }
    leftDistance = Ultrasonic.Ranging();
    //Serial.print("leftDistance:  ");
    //Serial.println(leftDistance);
    fixedServo.write(90);
    if ((rightDistance < 10) && (leftDistance < 10)) {
      Acebott.Move(Backward, 180);
      for (int i = 0; i < 1000; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
      Acebott.Move(Contrarotate, 180);  //delay(200);
      for (int i = 0; i < 500; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
    } else if (rightDistance < leftDistance) {
      Acebott.Move(Backward, 180);
      for (int i = 0; i < 500; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
      Acebott.Move(Contrarotate, 180);  //delay(200);
      for (int i = 0; i < 500; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
    }  //turn right
    else if (rightDistance > leftDistance) {
      Acebott.Move(Backward, 180);
      for (int i = 0; i < 500; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
      Acebott.Move(Clockwise, 180);  //delay(200);
      for (int i = 0; i < 500; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
    } else {
      Acebott.Move(Backward, 180);
      for (int i = 0; i < 500; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
      Acebott.Move(Clockwise, 180);  //delay(200);
      for (int i = 0; i < 500; i++) {
        delay(1);
        Receive_data();
        if (function_mode != AVOID)
          return;
      }
    }
  } else {
    Acebott.Move(Forward, 150);
  }
}

void model3_func()  // follow model
{
  fixedServo.write(90);
  UT_distance = Ultrasonic.Ranging();
  //Serial.println(UT_distance);
  if (UT_distance < 15) {
    Acebott.Move(Backward, 200);
  } else if (15 <= UT_distance && UT_distance <= 20) {
    Acebott.Move(Stop, 0);
  } else if (20 <= UT_distance && UT_distance <= 25) {
    Acebott.Move(Forward, speeds - 70);
  } else if (25 <= UT_distance && UT_distance <= 50) {
    Acebott.Move(Forward, 220);
  } else {
    Acebott.Move(Stop, 0);
  }
}

void model4_func()  // tracking model2
{
  fixedServo.write(90);
  Left_Tra_Value = analogRead(Left_sensor);
  Middle_Tra_Value = analogRead(Middle_sensor);
  Right_Tra_Value = analogRead(Right_sensor);
  delay(5);
  if (Left_Tra_Value < Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value < Black_Line) {
    Acebott.Move(Forward, 180);
  }
  if (Left_Tra_Value < Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value >= Black_Line) {
    Acebott.Move(Forward, 180);
  }
  if (Left_Tra_Value >= Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value < Black_Line) {
    Acebott.Move(Forward, 180);
  }

  else if (Left_Tra_Value >= Black_Line && Middle_Tra_Value < Black_Line && Right_Tra_Value < Black_Line) {
    Acebott.Move(Contrarotate, 220);
  } else if (Left_Tra_Value < Black_Line && Middle_Tra_Value < Black_Line && Right_Tra_Value >= Black_Line) {
    Acebott.Move(Clockwise, 220);
  }

  else if (Left_Tra_Value >= Off_Road && Middle_Tra_Value >= Off_Road && Right_Tra_Value >= Off_Road) {
    Acebott.Move(Stop, 0);
  }
}

void model1_func()  // tracking model1
{
  //fixedServo.write(90);
  Left_Tra_Value = analogRead(Left_sensor);
  //Middle_Tra_Value = analogRead(Middle_sensor);
  Right_Tra_Value = analogRead(Right_sensor);
  //Serial.println(Left_Tra_Value);
  delay(5);
  if (Left_Tra_Value < Black_Line && Right_Tra_Value < Black_Line) {
    Acebott.Move(Forward, 130);
  } else if (Left_Tra_Value >= Black_Line && Right_Tra_Value < Black_Line) {
    Acebott.Move(Contrarotate, 150);
  } else if (Left_Tra_Value < Black_Line && Right_Tra_Value >= Black_Line) {
    Acebott.Move(Clockwise, 150);
  } else if (Left_Tra_Value >= Black_Line && Left_Tra_Value < Off_Road && Right_Tra_Value >= Black_Line && Right_Tra_Value < Off_Road) {
    Acebott.Move(Stop, 0);
  } else if (Left_Tra_Value >= Off_Road && Right_Tra_Value >= Off_Road) {
    Acebott.Move(Stop, 0);
  }
}

void Servo_Move(int angles)  //servo
{

  int pwmValue = map(angles, 1, 180, 130, 70);
  int currentPwm = turnServo.read();
  
  if (pwmValue>currentPwm){
    for (int j = 0; j < 20; j++) {
      int newPwm = currentPwm + (pwmValue - currentPwm) * (j / 20.0);
      turnServo.write(newPwm);
      delay(20);
    }
  } else {
    for (int j = 0; j < 15; j++) {
      int newPwm = currentPwm + (pwmValue - currentPwm) * (j / 15.0);
      turnServo.write(newPwm);
      delay(20);
    }
  }
  

}

void Music_a() {
  for (int x = 0; x < length0; x++) {
    tone(Buzzer, tune0[x]);
    delay(500 * durt0[x]);
    noTone(Buzzer);
  }
}
void Music_b() {
  for (int x = 0; x < length1; x++) {
    tone(Buzzer, tune1[x]);
    delay(500 * durt1[x]);
    noTone(Buzzer);
  }
}
void Music_c() {
  for (int x = 0; x < length2; x++) {
    tone(Buzzer, tune2[x]);
    delay(500 * durt2[x]);
    noTone(Buzzer);
  }
}
void Music_d() {
  for (int x = 0; x < length3; x++) {
    tone(Buzzer, tune3[x]);
    delay(300 * durt3[x]);
    noTone(Buzzer);
  }
}
void Buzzer_run(int M) {
  switch (M) {
    case 0x01:
      Music_a();
      break;
    case 0x02:
      Music_b();
      break;
    case 0x03:
      Music_c();
      break;
    case 0x04:
      Music_d();
      break;
    default:
      break;
  }
}

void runModule(int device) {
  val = readBuffer(12);
  switch (device) {
    case 0x0C:
      {
        switch (val) {
          case 0x01:
            Acebott.Move(Forward, speeds);
            break;
          case 0x02:
            Acebott.Move(Backward, speeds);
            break;
          case 0x03:
            Acebott.Move(Move_Left, speeds);
            break;
          case 0x04:
            Acebott.Move(Move_Right, speeds);
            break;
          case 0x05:
            Acebott.Move(Top_Left, speeds);
            break;
          case 0x06:
            Acebott.Move(Bottom_Left, speeds);
            break;
          case 0x07:
            Acebott.Move(Top_Right, speeds);
            break;
          case 0x08:
            Acebott.Move(Bottom_Right, speeds);
            break;
          case 0x0A:
            Acebott.Move(Clockwise, speeds);
            break;
          case 0x09:
            Acebott.Move(Contrarotate, speeds);
            break;
          case 0x00:
            Acebott.Move(Stop, 0);
            break;
          default:
            break;
        }
      }
      break;
    case 0x02:
      {
        Servo_Move(val);
      }
      break;
    case 0x03:
      {
        Buzzer_run(val);
      }
      break;
    case 0x05:
      {
        digitalWrite(LED_Module1, val);
        digitalWrite(LED_Module2, val);
      }
      break;
    case 0x08:
      {
        digitalWrite(Shoot_PIN, HIGH);
        delay(200);
        digitalWrite(Shoot_PIN, LOW);
      }
      break;
    case 0x0D:
      {
        speeds = val;
      }
      break;
  }
}
void parseData() {
  isStart = false;
  int action = readBuffer(9);
  int device = readBuffer(10);
  switch (action) {
    case CMD_RUN:
      //callOK_Len01();
      function_mode = STANDBY;
      runModule(device);
      break;
    case CMD_STANDBY:
      //callOK_Len01();
      function_mode = STANDBY;
      Acebott.Move(Stop, 0);
      fixedServo.write(90);
      break;
    case CMD_TRACK_1:
      //callOK_Len01();
      function_mode = TRACK_1;
      //Serial.write(0x01);
      break;
    case CMD_TRACK_2:
      //callOK_Len01();
      function_mode = TRACK_2;
      break;
    case CMD_AVOID:
      //callOK_Len01();
      function_mode = AVOID;
      break;
    case CMD_FOLLOW:
      //callOK_Len01();
      function_mode = FOLLOW;
      break;
    default: break;
  }
}

void RXpack_func()  //Receive data
{
  client = server.available();  // Waiting for client to connect
  if (client)                   // If there is a client connection
  {
    WA_en = true;                          // enable write enable
    ED_client = true;                      // Client connection flag set to true
    Serial.println("[Client connected]");  // Print client connection information

    while (client.connected())  // While the client is still connected
    {
      if (client.available())  // If there is data to read
      {
        unsigned char c = client.read() & 0xff;  // Read data
        Serial.write(c);                         // Print received data
        if (c == 0x55 && isStart == false)       // If the received data is 0x55 and isStart is false
        {
          if (prevc == 0xff)  // If the previous byte is 0xff
          {
            index_a = 1;     // Index is set to 1
            isStart = true;  // Data start flag is set to true
          }
        } else {
          prevc = c;    // Update the value of the previous byte
          if (isStart)  // If data start flag is true
          {
            if (index_a == 2)  // if index is 2
            {
              dataLen = c;           // The data length is set to c
            } else if (index_a > 2)  // if index is greater than 2
            {
              dataLen--;  // Data length minus 1
            }
            writeBuffer(index_a, c);  // Write data to buffer
          }
        }
        index_a++;          // Index increases by 1
        if (index_a > 120)  // If the index is greater than 120
        {
          index_a = 0;      // Index reset to 0
          isStart = false;  // Data start flag is set to false
        }
        if (isStart && dataLen == 0 && index_a > 3)  // If the data start flag is true and the data length is 0 and the index is greater than 3
        {
          isStart = false;  // Data start flag is set to false
          parseData();      // Analytical data
          index_a = 0;      // Index is set to 0
        }
      }
      functionMode();          // Function pattern processing
      if (Serial.available())  // If there is data in the serial port, it can be read
      {
        char c = Serial.read();  // Read data
        sendBuff += c;           // Add data to send buffer
        client.print(sendBuff);  // Send data to client
        Serial.print(sendBuff);  // Print sent data
        sendBuff = "";           // Clear send buffer
      }
    }
    client.stop();                            // Disconnect client
    Serial.println("[Client disconnected]");  // Print client disconnect information
  } else                                      // If no client is connected
  {
    if (ED_client == true)  // If there was a client connection before
    {
      ED_client = false;  // Client connection flag set to false
    }
  }
}
