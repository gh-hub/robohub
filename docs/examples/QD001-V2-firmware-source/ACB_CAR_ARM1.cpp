#include "ACB_CAR_ARM.h"
#include <ACB_ESP32Servo.h>
#include "esp_http_server.h"


#define L0 800
#define L1 700
#define L2 1200
#define pi 3.1415926

#define TX_PIN 17
#define RX_PIN 16  // 添加RX引脚定义

Servo myservo1;          // create servo object to control a servo
Servo myservo2;
Servo myservo3;
Servo myservo4;
Servo myservo5;

Servo turnServo;

String sendBuff;
byte dataLen, index_a = 0;
char buffer[52];
unsigned char prevc = 0;
bool isStart = false;
bool ED_client = true;
bool WA_en = false;
byte RX_package[17] = {0};

int ACB_CAR_ARM::val = 0;
int ACB_CAR_ARM::Chassis_Silde_Angle;
int ACB_CAR_ARM::Shoulder_Silde_Angle;
int ACB_CAR_ARM::Elbow_Silde_Angle;
int ACB_CAR_ARM::Wrist_Silde_Angle;
int ACB_CAR_ARM::Claws_Silde_Angle;

int ACB_CAR_ARM::RGB_Red_Val;
int ACB_CAR_ARM::RGB_Blue_Val;
int ACB_CAR_ARM::RGB_Green_Val;

int ACB_CAR_ARM::PTP_X;
int ACB_CAR_ARM::PTP_Y;
int ACB_CAR_ARM::PTP_Z;

int ACB_CAR_ARM::stateCount1 = 0;
int ACB_CAR_ARM::stateCount2 = 0;
int ACB_CAR_ARM::stateCount3 = 0;
int ACB_CAR_ARM::stateCount4 = 0;
int ACB_CAR_ARM::stateCount5 = 0;
int ACB_CAR_ARM::stateCount6 = 0;

int ACB_CAR_ARM::mode = 1;

// ======16*8屏幕==
uint8_t ACB_CAR_ARM::g_screen_pattern = 0;
uint8_t ACB_CAR_ARM::g_screen_data[16];
// ===== MP3 ===== 
uint8_t ACB_CAR_ARM::g_mp3_volume = 0;
int8_t  ACB_CAR_ARM::g_mp3_cmd = -1;         

int ROI_x;
int ROI_y;
int ROI_w;
int ROI_h;
int Start = 1;
int vehicleVersion = 1; 

typedef struct {
        httpd_req_t *req;
        size_t len;
} jpg_chunking_t;

httpd_handle_t camera_httpd = NULL;

unsigned char readBuffer(int index_r)
{
    return buffer[index_r];
}
void writeBuffer(int index_w, unsigned char c)
{
    buffer[index_w] = c;
}



ACB_CAR_ARM::ACB_CAR_ARM()
{
    // pinMode(SHCP_PIN, OUTPUT);
    // pinMode(EN_PIN, OUTPUT);
    // pinMode(DATA_PIN, OUTPUT);
    // pinMode(STCP_PIN, OUTPUT);
    // pinMode(PWM1_PIN, OUTPUT);
    // pinMode(PWM2_PIN, OUTPUT);

    Serial.begin(115200);

    // pinMode(Trig_PIN, OUTPUT);
    // pinMode(Echo_PIN, INPUT);

    // pinMode(Left_sensor, INPUT);  // Set infrared left sensor pin as input
    // pinMode(Middle_sensor, INPUT);  // Set the infrared middle sensor pin as input
    // pinMode(Right_sensor, INPUT);  // Set the right infrared sensor pin as input

    // Vehicle_Move(Stop, 0);
}

void ACB_CAR_ARM::init()
{
    server = new WiFiServer(100);
    server->begin();
}

void ACB_CAR_ARM::Car_init(char version = vehicleVersion)
{
  vehicleVersion = version;
  
  if(version == 1){
    Vehicle_init();
    Vehicle_Move(Stop, 0);
  }
  else if(version == 2){
    Vehicle_init_V2();
  }

  pinMode(Left_sensor, INPUT);  // Set infrared left sensor pin as input
  pinMode(Middle_sensor, INPUT);  // Set the infrared middle sensor pin as input
  pinMode(Right_sensor, INPUT);  // Set the right infrared sensor pin as input

}

void ACB_CAR_ARM::ARM_init(int servo1, int servo2, int servo3, int servo4, int servo5) {
    myservo1.attach(servo1);   // set the control pin of servo 1 to D3  dizuo-servo1-3
    myservo2.attach(servo2);  // set the control pin of servo 2 to D5  arm-servo2-5
    myservo3.attach(servo3);  //set the control pin of servo 3 to D6   lower arm-servo-6
    myservo4.attach(servo5);  // set the control pin of servo 4 to D9  claw-servo-9
    myservo5.attach(servo4);

    // myservo1.write(chassis_angle);
    // delay(1000);
    // myservo2.write(shoulder_angle);
    // myservo3.write(elbow_angle);
    // myservo4.write(claws_angle);
    // myservo5.write(wrist_angle);
    // delay(1500);
    // ACB_CAR_ARM::Zero();

    int pwmValue1 = map(90, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    myservo1.writeMicroseconds(pwmValue1);
    int pwmValue2 = map(40, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    myservo2.writeMicroseconds(pwmValue2);
    int pwmValue3 = map(50, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    myservo3.writeMicroseconds(pwmValue3);
    int pwmValue4 = map(90, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    myservo4.writeMicroseconds(pwmValue4);
    int pwmValue5 = map(90, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    myservo5.writeMicroseconds(pwmValue5);

}

void ACB_CAR_ARM::Silde_ChassisCmd(float chassis_angles) 
{
  if (chassis_angles > 180) { //limit the angle when turn right
    chassis_angles = 180;
  }
  if (chassis_angles < 0) { // limit the angle when turn left
    chassis_angles = 0;
  }
  chassis_angle = chassis_angles;
  int pwmValue;
  pwmValue = map(chassis_angles, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX); 
  myservo1.writeMicroseconds(pwmValue);
  delay(8);
  
}

void ACB_CAR_ARM::Silde_ShoulderCmd(float shoulder_angles) 
{
  if (shoulder_angles > 180) { //limit the angle when turn right
    shoulder_angles = 180;
  }
  if (shoulder_angles < 0) { // limit the angle when turn left
    shoulder_angles = 0;
  }

  shoulder_angle = shoulder_angles;

  int pwmValue;
  pwmValue = map(shoulder_angles, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);  
  
  limitZ(shoulder_angle,elbow_angle);
  if (limit_z <= 0){            //if z<=0 , limit down
    Serial.println("Out of range");
    delay(500);
  } else {
    myservo2.writeMicroseconds(pwmValue); 
    delay(8);
  }
  

}

void ACB_CAR_ARM::Silde_ElbowCmd(float elbow_angles) 
{
  if (elbow_angles > 180) { //limit the angle when turn right
    elbow_angles = 180;
  }
  if (elbow_angles < 0) { // limit the angle when turn left
    elbow_angles = 0;
  }

  elbow_angle = elbow_angles;

  int pwmValue;
  pwmValue = map(elbow_angles, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX); 
  
  limitZ(shoulder_angle,elbow_angle);
  if (limit_z <= 0){               //if z<=0 , limit down
    Serial.println("Out of range");
    delay(500);
  } else {
    myservo3.writeMicroseconds(pwmValue);
    delay(8);
  }
}

void ACB_CAR_ARM::Silde_WristCmd(float wrist_angles) 
{
  if (wrist_angles > 180) { //limit the angle when turn right
    wrist_angles = 180;
  }
  if (wrist_angles < 0) { // limit the angle when turn left
    wrist_angles = 0;
  }

  wrist_angle = wrist_angles;

  int pwmValue;
  pwmValue = map(wrist_angles, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX); 
  myservo5.writeMicroseconds(pwmValue);
  delay(8);
  
}

void ACB_CAR_ARM::Silde_ClawsCmd(float claws_angles) 
{
  if (claws_angles > 180) { //limit the angle when turn right
    claws_angles = 180;
  }
  if (claws_angles < 90) { // limit the angle when turn left
    claws_angles = 90;
  }

  claws_angle = claws_angles;

  int pwmValue;
  pwmValue = map(claws_angles, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX); 
  myservo4.writeMicroseconds(pwmValue);
  delay(8);
  
}

void ACB_CAR_ARM::limitZ (float pos__2, float pos__3)
{
  float angle2 = pos__2;  
  float angle3 = pos__3; 

  // Calculate the radian value of the joint Angle
  float rad2 = radians(angle2);
  float rad3 = radians(180-angle3);

  // Calculate the coordinates of joint 2
  float x2 = arm2_length * cos(rad2);
  float z2 = arm2_length * sin(rad2);

  // Calculate the coordinates of the end effector
  float x = x2 + arm3_length * cos(rad2 + rad3);
  limit_z = z2 + arm3_length * sin(rad2 + rad3) + 14;
}

void ACB_CAR_ARM::Chassis_angle_adjust(float chassis_pos,float right_pos,float left_pos)
{
  // --------------------------误差调整--------------------------
  WuchaPos = chassis_pos;
  chassis_angle  =  90 + chassis_pos; // 底盘舵机中心误差（中心:90），-x轴：90-180 x轴：90-0，往右偏则增加chassis_pos，往左则减小
  chassis_pos2 = chassis_pos;
  right_poss = right_pos; // 底盘舵机右转误差，中心增加8，则right_pos=8
  left_poss = left_pos; // 底盘舵机左转误差，中心增加8，则left_pos=10
  // -----------------------------------------------------------
}

void ACB_CAR_ARM::Slight_adjust(float right_pos,float left_pos)
{
  // --------------------------误差调整--------------------------
  // chassis_angle  =  chassis_pos; // 底盘舵机中心误差（中心:90），-x轴：90-180 x轴：90-0，往右偏则增加chassis_pos，往左则减小
  right_poss = right_pos; // 底盘舵机右转误差，中心增加8，则right_pos=8
  left_poss = left_pos; // 底盘舵机左转误差，中心增加8，则left_pos=10
  // -----------------------------------------------------------
}

void ACB_CAR_ARM::PtpCmd (float x, float y, float z) 
{
  
  float sphereCenter[] = {0, 0, 11};
  float r_max = 25;
  float distance_max = sqrt(pow(x - sphereCenter[0], 2) + pow(y - sphereCenter[1], 2) + pow(z - sphereCenter[2], 2));
  float r_min = 12;
  float distance_min = sqrt(pow(x - sphereCenter[0], 2) + pow(y - sphereCenter[1], 2) + pow(z - sphereCenter[2], 2));

  if (x>25 || x<-25 ){
    Serial.println("Exceeds the value range of x.");
    return;
  } else if ( y>25 || y<0 ){
    Serial.println("Exceeds the value range of y.");
    return;
  } else if ( z>36 || z<0 ){
    Serial.println("Exceeds the value range of z.");
    return;
  } else if ( x==0 && y==0 && z<28 ){
    Serial.println("Exceeds the value range of z.");
    return;
  } else if ( distance_max > r_max ){
    Serial.println("Out of range!");
    return;
  } else if ( distance_min < r_min ){
    Serial.println("Out of range!");
    return;
  } else {
    float Alpha = 0;


  
  if (x == 0 && y != 0) {
    y = y - 1;
    z = z-2;
    int chassis_pos1 = 90 + chassis_pos2;
    int pwmValue1 = map(chassis_pos1, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    // Get the PWM value of the current steering gear
    int currentPwm1 = myservo1.readMicroseconds();
    //Gradually adjust the PWM value of the steering gear to the target value
    for (int j = 0; j < 20; j++) {
      int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 20.0);
      // Set the PWM value of the steering gear
      myservo1.writeMicroseconds(newPwm1);
      delay(20);
    }
    chassis_angle  = chassis_pos1;

  } else if (x > 0 && y == 0) {
    x = x-1;
    z = z-2;
    int pwmValue1 = map(0, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    // Get the PWM value of the current steering gear
    int currentPwm1 = myservo1.readMicroseconds();
    //Gradually adjust the PWM value of the steering gear to the target value
    for (int j = 0; j < 20; j++) {
      int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 20.0);
      // Set the PWM value of the steering gear
      myservo1.writeMicroseconds(newPwm1);
      delay(20);
    }
    chassis_angle  = 0;

  } else if (x < 0 && y == 0) {
    x = x+1;
    z = z-2;
    int pwmValue1 = map(180, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    // Get the PWM value of the current steering gear
    int currentPwm1 = myservo1.readMicroseconds();
    //Gradually adjust the PWM value of the steering gear to the target value
    for (int j = 0; j < 20; j++) {
      int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 20.0);
      // Set the PWM value of the steering gear
      myservo1.writeMicroseconds(newPwm1);
      delay(20);
    }
    chassis_angle  = 180;

  } else if (x == 0 && y == 0) {
    z = z-2;
    int chassis_pos1 = 90 + chassis_pos2;
    int pwmValue1 = map(chassis_pos1, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    // Get the PWM value of the current steering gear
    int currentPwm1 = myservo1.readMicroseconds();
    //Gradually adjust the PWM value of the steering gear to the target value
    for (int j = 0; j < 20; j++) {
      int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 20.0);
      // Set the PWM value of the steering gear
      myservo1.writeMicroseconds(newPwm1);
      delay(20);
    }
    chassis_angle  = chassis_pos1;

  } else {
    // z = z-2;
    if (x>0){
      x = x + 1;
      y = y - 1;
    } else {
      x = x - 1;
      y = y - 1;
    }
    int xz_angle1 = atan(x / y) * 180.0 / pi + 90; 
    if ( xz_angle1 < 90){
      xz_angle1 = 180 - xz_angle1 + chassis_pos2 + right_poss;
    } else {
      xz_angle1 = 180 - xz_angle1 + chassis_pos2 + left_poss;
    }
    int pwmValue1 = map(xz_angle1, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
    // Get the PWM value of the current steering gear
    int currentPwm1 = myservo1.readMicroseconds();
    //Gradually adjust the PWM value of the steering gear to the target value
    for (int j = 0; j < 20; j++) {
      int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 20.0);
      // Set the PWM value of the steering gear
      myservo1.writeMicroseconds(newPwm1);
      delay(20);
    }
    chassis_angle  = xz_angle1;

  }

  // z = z-2;

  delay(200);

  x = x * 100;
  y = y * 100;
  z = z * 100;

  y = sqrt(x*x + y*y);  //Hypotenuse of the x and y coordinates
  z = z - L0;  // - L3 * sin(Alpha * pi / 180.0);

  if (z < -L0) {
    // Serial.println("False");
  }

  if (sqrt(y * y + z * z) > (L1 + L2)) {
    // Serial.print("False");
  }

  float ccc = acos(y / sqrt(y * y + z * z));
  float bbb = (y * y + z * z + L1 * L1 - L2 * L2) / (2 * L1 * sqrt(y * y + z * z));

  if (bbb > 1 || bbb < -1) {
    // Serial.print("False");
  }

  int zf_flag = z < 0 ? -1 : 1;

  servo_angle2 = ccc * zf_flag + acos(bbb);   // Calculate the arc of steering gear 2
  servo_angle2 = servo_angle2 * 180.0 / pi; // Conversion Angle
  servo_angle2 = 180 - servo_angle2;

  if(servo_angle2 > 180.0 || servo_angle2 < 0.0) {
    // Serial.print("False");
  }

  float aaa = -(y * y + z * z - L1 * L1 - L2 * L2) / (2 * L1 * L2);

  if (aaa > 1 || aaa < -1) {
    // Serial.print("False");
  }

  servo_angle3 = acos(aaa); 
  servo_angle3 = servo_angle3 * 180.0 / pi; 
  if (servo_angle3 > 135.0 || servo_angle3 < -135.0) {
    // Serial.print("False");
  }

  servo_angle4 = Alpha - servo_angle2 + servo_angle3;
  if(servo_angle4 > 90.0 || servo_angle4 < -90.0) {
    // Serial.print("False");
  }

  int ValuePWM3 = map(servo_angle3, 0, 180, SERVOMIN, SERVOMAX);
  int currentPwm3 = myservo3.readMicroseconds();
  for (int j = 0; j < 20; j++) {
    int newPwm3 = currentPwm3 + (ValuePWM3 - currentPwm3) * (j / 20.0);
    // Set the PWM value of the steering gear
    myservo3.writeMicroseconds(newPwm3);
    delay(20);
  }
  elbow_angle  = servo_angle3;

  delay(100);
  
  int ValuePWM2 = map(servo_angle2, 0, 180, SERVOMIN, SERVOMAX);
  int currentPwm2 = myservo2.readMicroseconds();
  for (int j = 0; j < 20; j++) {
    int newPwm2 = currentPwm2 + (ValuePWM2 - currentPwm2) * (j / 20.0);
    // Set the PWM value of the steering gear
    myservo2.writeMicroseconds(newPwm2);
    delay(20);
  }
  shoulder_angle  = servo_angle2;

  }

} //inverseKinematics


void ACB_CAR_ARM::Zero()
{
  // Map the position data to the PWM range of the steering gear control
  int pwmValue5 = map(90, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm5 = myservo5.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < 25; j++) {
    int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / 25.0);
    // Set the PWM value of the steering gear
    myservo5.writeMicroseconds(newPwm5);
    delay(25);
  }

  // Map the position data to the PWM range of the steering gear control
  int pwmValue4 = map(90, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm4 = myservo4.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < 25; j++) {
    int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / 25.0);
    // Set the PWM value of the steering gear
    myservo4.writeMicroseconds(newPwm4);
    delay(25);
  }

  // Map the position data to the PWM range of the steering gear control
  int pwmValue3 = map(50, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm3 = myservo3.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < 25; j++) {
    int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / 25.0);
    // Set the PWM value of the steering gear
    myservo3.writeMicroseconds(newPwm3);
    delay(25);
  }

  // Map the position data to the PWM range of the steering gear control
  int pwmValue2 = map(40, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm2 = myservo2.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < 25; j++) {
    int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / 25.0);
    // Set the PWM value of the steering gear
    myservo2.writeMicroseconds(newPwm2);
    delay(25);
  }

  

  int posss = WuchaPos + 90;

  // Map the position data to the PWM range of the steering gear control
  int pwmValue1 = map(posss, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm1 = myservo1.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < 25; j++) {
    int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 25.0);
    // Set the PWM value of the steering gear
    myservo1.writeMicroseconds(newPwm1);
    delay(25);
  }

  chassis_angle = posss;
  shoulder_angle = 40;
  elbow_angle = 50;
  claws_angle = 90;
  wrist_angle = 90; 

}

//speed
void ACB_CAR_ARM::Speed(int speeds)
{
  if (speeds > 100){
    speeds = 100;
  } else if (speeds < 0){
    speeds = 1;
  }
  speed = 1000 / speeds;
}

// 有速度
void ACB_CAR_ARM::ClawsCmd(int poss)
{
  claws_angle = poss;
  float s = speed;
  // Map the position data to the PWM range of the steering gear control
  int pwmValue4 = map(poss, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm4 = myservo4.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < speed; j++) {
    int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / s);
    // Set the PWM value of the steering gear
    myservo4.writeMicroseconds(newPwm4);
    delay(speed);
  }
}

void ACB_CAR_ARM::WristCmd(int poss)
{
  wrist_angle = poss;
  float s = speed;
  // Map the position data to the PWM range of the steering gear control
  int pwmValue5 = map(poss, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm5 = myservo5.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < speed; j++) {
    int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / s);
    // Set the PWM value of the steering gear
    myservo5.writeMicroseconds(newPwm5);
    delay(speed);
  }
}

void ACB_CAR_ARM::ElbowCmd(int poss)
{
  elbow_angle = poss;
  float s = speed;
  // Map the position data to the PWM range of the steering gear control
  int pwmValue3 = map(poss, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm3 = myservo3.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < speed; j++) {
    int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / s);
    // Set the PWM value of the steering gear
    myservo3.writeMicroseconds(newPwm3);
    delay(speed);
  }
}

void ACB_CAR_ARM::ShoulderCmd(int poss)
{
  shoulder_angle = poss;
  float s = speed;
  // Map the position data to the PWM range of the steering gear control
  int pwmValue2 = map(poss, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm2 = myservo2.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < speed; j++) {
    int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / s);
    // Set the PWM value of the steering gear
    myservo2.writeMicroseconds(newPwm2);
    delay(speed);
  }
}

void ACB_CAR_ARM::ChassisCmd(int poss)
{
  chassis_angle = poss;
  float s = speed;
  // Map the position data to the PWM range of the steering gear control
  int pwmValue1 = map(poss, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
  // Get the PWM value of the current steering gear
  int currentPwm1 = myservo1.readMicroseconds();
  //Gradually adjust the PWM value of the steering gear to the target value
  for (int j = 0; j < speed; j++) {
    int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / s);
    // Set the PWM value of the steering gear
    myservo1.writeMicroseconds(newPwm1);
    delay(speed);
  }
}

// memory 
void ACB_CAR_ARM::saveState() 
{
  if (ACB_CAR_ARM::mode == 1) {    // Selection mode
    if (ACB_CAR_ARM::stateCount1 < maxStates) {  // Check whether the number of states is smaller than the maximum number
      states1[ACB_CAR_ARM::stateCount1].pos1 = chassis_angle ;  //Save state
      states1[ACB_CAR_ARM::stateCount1].pos2 = shoulder_angle ;
      states1[ACB_CAR_ARM::stateCount1].pos3 = elbow_angle ;
      states1[ACB_CAR_ARM::stateCount1].pos4 = claws_angle ;
      states1[ACB_CAR_ARM::stateCount1].pos5 = wrist_angle ;
      ACB_CAR_ARM::stateCount1++;
      Serial.println("State1 saved");
    } else {
      Serial.println("Cannot save more states");
    }
  } else if (ACB_CAR_ARM::mode == 2){
    if (ACB_CAR_ARM::stateCount2 < maxStates) {
      states2[ACB_CAR_ARM::stateCount2].pos1 = chassis_angle;
      states2[ACB_CAR_ARM::stateCount2].pos2 = shoulder_angle;
      states2[ACB_CAR_ARM::stateCount2].pos3 = elbow_angle;
      states2[ACB_CAR_ARM::stateCount2].pos4 = claws_angle;
      states2[ACB_CAR_ARM::stateCount2].pos5 = wrist_angle ;
      ACB_CAR_ARM::stateCount2++;
      Serial.println("State2 saved");
    } else {
      Serial.println("Cannot save more states");
    }
  } else if (ACB_CAR_ARM::mode == 3){
    if (ACB_CAR_ARM::stateCount3 < maxStates) {
      states3[ACB_CAR_ARM::stateCount3].pos1 = chassis_angle;
      states3[ACB_CAR_ARM::stateCount3].pos2 = shoulder_angle;
      states3[ACB_CAR_ARM::stateCount3].pos3 = elbow_angle;
      states3[ACB_CAR_ARM::stateCount3].pos4 = claws_angle;
      states3[ACB_CAR_ARM::stateCount3].pos5 = wrist_angle ;
      ACB_CAR_ARM::stateCount3++;
      Serial.println("State3 saved");
    } else {
      Serial.println("Cannot save more states");
    }
  } else if (ACB_CAR_ARM::mode == 4){
    if (ACB_CAR_ARM::stateCount4 < maxStates) {
      states4[ACB_CAR_ARM::stateCount4].pos1 = chassis_angle;
      states4[ACB_CAR_ARM::stateCount4].pos2 = shoulder_angle;
      states4[ACB_CAR_ARM::stateCount4].pos3 = elbow_angle;
      states4[ACB_CAR_ARM::stateCount4].pos4 = claws_angle;
      states4[ACB_CAR_ARM::stateCount4].pos5 = wrist_angle ;
      ACB_CAR_ARM::stateCount4++;
      Serial.println("State4 saved");
    } else {
      Serial.println("Cannot save more states");
    }
  } else if (ACB_CAR_ARM::mode == 5){
    if (ACB_CAR_ARM::stateCount5 < maxStates) {
      states5[ACB_CAR_ARM::stateCount5].pos1 = chassis_angle;
      states5[ACB_CAR_ARM::stateCount5].pos2 = shoulder_angle;
      states5[ACB_CAR_ARM::stateCount5].pos3 = elbow_angle;
      states5[ACB_CAR_ARM::stateCount5].pos4 = claws_angle;
      states5[ACB_CAR_ARM::stateCount5].pos5 = wrist_angle ;
      ACB_CAR_ARM::stateCount5++;
      Serial.println("State5 saved");
    } else {
      Serial.println("Cannot save more states");
    }
  } else if (ACB_CAR_ARM::mode == 6){
    if (ACB_CAR_ARM::stateCount6 < maxStates) {
      states6[ACB_CAR_ARM::stateCount6].pos1 = chassis_angle;
      states6[ACB_CAR_ARM::stateCount6].pos2 = shoulder_angle;
      states6[ACB_CAR_ARM::stateCount6].pos3 = elbow_angle;
      states6[ACB_CAR_ARM::stateCount6].pos4 = claws_angle;
      states6[ACB_CAR_ARM::stateCount6].pos5 = wrist_angle ;
      ACB_CAR_ARM::stateCount6++;
      Serial.println("State6 saved");
    }else {
      Serial.println("Cannot save more states");
    }
  } else{
    Serial.println("No mode");
    }

}

void ACB_CAR_ARM::executeStates() 
{    // run
  if (ACB_CAR_ARM::mode == 1){
    // Iterate over the saved state and perform the appropriate action
    for (int i = 0; i < ACB_CAR_ARM::stateCount1; i++) {
      chassis_angle = states1[i].pos1;
      shoulder_angle = states1[i].pos2;
      elbow_angle = states1[i].pos3;
      claws_angle = states1[i].pos4;
      wrist_angle = states1[i].pos5;

      // Map the position data to the PWM range of the steering gear control
      int pwmValue1 = map(chassis_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue2 = map(shoulder_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue3 = map(elbow_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue4 = map(claws_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue5 = map(wrist_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);

      // Get the PWM value of the current steering gear
      int currentPwm1 = myservo1.readMicroseconds();
      int currentPwm2 = myservo2.readMicroseconds();
      int currentPwm3 = myservo3.readMicroseconds();
      int currentPwm4 = myservo4.readMicroseconds();
      int currentPwm5 = myservo5.readMicroseconds();

      //Gradually adjust the PWM value of the steering gear to the target value
      for (int j = 0; j < 30; j++) {
        int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 30.0);
        int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / 30.0);
        int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / 30.0);
        int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / 30.0);
        int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / 30.0);

        // Set the PWM value of the steering gear
        myservo1.writeMicroseconds(newPwm1);
        myservo2.writeMicroseconds(newPwm2);
        myservo3.writeMicroseconds(newPwm3);
        myservo4.writeMicroseconds(newPwm4);
        myservo5.writeMicroseconds(newPwm5);

        delay(20);
      }
      delay(100);
    }
  currentState1 = 0; // Reset current state
  // shouldStop = false;
  } else if (ACB_CAR_ARM::mode == 2){
    for (int i = 0; i < ACB_CAR_ARM::stateCount2; i++) {
      chassis_angle = states2[i].pos1;
      shoulder_angle  = states2[i].pos2;
      elbow_angle  = states2[i].pos3;
      claws_angle  = states2[i].pos4;
      wrist_angle  = states2[i].pos5;

      int pwmValue1 = map(chassis_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue2 = map(shoulder_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue3 = map(elbow_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue4 = map(claws_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue5 = map(wrist_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);

      int currentPwm1 = myservo1.readMicroseconds();
      int currentPwm2 = myservo2.readMicroseconds();
      int currentPwm3 = myservo3.readMicroseconds();
      int currentPwm4 = myservo4.readMicroseconds();
      int currentPwm5 = myservo5.readMicroseconds();

      for (int j = 0; j < 30; j++) {
        int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 30.0);
        int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / 30.0);
        int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / 30.0);
        int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / 30.0);
        int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / 30.0);

        myservo1.writeMicroseconds(newPwm1);
        myservo2.writeMicroseconds(newPwm2);
        myservo3.writeMicroseconds(newPwm3);
        myservo4.writeMicroseconds(newPwm4);
        myservo5.writeMicroseconds(newPwm5);

        delay(20);
      }
      delay(100);
    }
  currentState2 = 0; // Reset current state
  // shouldStop = false;
  } else if (ACB_CAR_ARM::mode == 3){
    for (int i = 0; i < ACB_CAR_ARM::stateCount3; i++) {
      chassis_angle  = states3[i].pos1;
      shoulder_angle  = states3[i].pos2;
      elbow_angle  = states3[i].pos3;
      claws_angle  = states3[i].pos4;
      wrist_angle = states3[i].pos5;

      int pwmValue1 = map(chassis_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue2 = map(shoulder_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue3 = map(elbow_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue4 = map(claws_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue5 = map(wrist_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);

      int currentPwm1 = myservo1.readMicroseconds();
      int currentPwm2 = myservo2.readMicroseconds();
      int currentPwm3 = myservo3.readMicroseconds();
      int currentPwm4 = myservo4.readMicroseconds();
      int currentPwm5 = myservo5.readMicroseconds();

      for (int j = 0; j < 30; j++) {
        int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 30.0);
        int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / 30.0);
        int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / 30.0);
        int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / 30.0);
        int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / 30.0);

        myservo1.writeMicroseconds(newPwm1);
        myservo2.writeMicroseconds(newPwm2);
        myservo3.writeMicroseconds(newPwm3);
        myservo4.writeMicroseconds(newPwm4);
        myservo5.writeMicroseconds(newPwm5);

        delay(20);
      }
      delay(100);
    }
    currentState3 = 0; // Reset current state
    // shouldStop = false;
  } else if (ACB_CAR_ARM::mode == 4){
    for (int i = 0; i < ACB_CAR_ARM::stateCount4; i++) {
      chassis_angle  = states4[i].pos1;
      shoulder_angle  = states4[i].pos2;
      elbow_angle  = states4[i].pos3;
      claws_angle  = states4[i].pos4;
      wrist_angle = states4[i].pos5;

      int pwmValue1 = map(chassis_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue2 = map(shoulder_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue3 = map(elbow_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue4 = map(claws_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue5 = map(wrist_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);

      int currentPwm1 = myservo1.readMicroseconds();
      int currentPwm2 = myservo2.readMicroseconds();
      int currentPwm3 = myservo3.readMicroseconds();
      int currentPwm4 = myservo4.readMicroseconds();
      int currentPwm5 = myservo5.readMicroseconds();

      for (int j = 0; j < 30; j++) {
        int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 30.0);
        int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / 30.0);
        int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / 30.0);
        int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / 30.0);
        int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / 30.0);

        myservo1.writeMicroseconds(newPwm1);
        myservo2.writeMicroseconds(newPwm2);
        myservo3.writeMicroseconds(newPwm3);
        myservo4.writeMicroseconds(newPwm4);
        myservo5.writeMicroseconds(newPwm5);

        delay(20);
      }
      delay(100);
    }
    currentState4 = 0; // Reset current state
    // shouldStop = false;
  } else if (ACB_CAR_ARM::mode == 5){
    for (int i = 0; i < ACB_CAR_ARM::stateCount5; i++) {
      chassis_angle  = states5[i].pos1;
      shoulder_angle  = states5[i].pos2;
      elbow_angle  = states5[i].pos3;
      claws_angle  = states5[i].pos4;
      wrist_angle = states5[i].pos5;

      int pwmValue1 = map(chassis_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue2 = map(shoulder_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue3 = map(elbow_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue4 = map(claws_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue5 = map(wrist_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);

      int currentPwm1 = myservo1.readMicroseconds();
      int currentPwm2 = myservo2.readMicroseconds();
      int currentPwm3 = myservo3.readMicroseconds();
      int currentPwm4 = myservo4.readMicroseconds();
      int currentPwm5 = myservo5.readMicroseconds();

      for (int j = 0; j < 30; j++) {
        int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 30.0);
        int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / 30.0);
        int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / 30.0);
        int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / 30.0);
        int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / 30.0);

        myservo1.writeMicroseconds(newPwm1);
        myservo2.writeMicroseconds(newPwm2);
        myservo3.writeMicroseconds(newPwm3);
        myservo4.writeMicroseconds(newPwm4);
        myservo5.writeMicroseconds(newPwm5);
        delay(20);
      }
      delay(100);
    }
    currentState5 = 0; // Reset current state
    // shouldStop = false;
  } else if (ACB_CAR_ARM::mode == 6){
    for (int i = 0; i < ACB_CAR_ARM::stateCount6; i++) {
      chassis_angle  = states6[i].pos1;
      shoulder_angle  = states6[i].pos2;
      elbow_angle  = states6[i].pos3;
      claws_angle  = states6[i].pos4;
      wrist_angle = states6[i].pos5;

      int pwmValue1 = map(chassis_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue2 = map(shoulder_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue3 = map(elbow_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue4 = map(claws_angle , PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);
      int pwmValue5 = map(wrist_angle, PWMRES_Min, PWMRES_Max, SERVOMIN, SERVOMAX);

      int currentPwm1 = myservo1.readMicroseconds();
      int currentPwm2 = myservo2.readMicroseconds();
      int currentPwm3 = myservo3.readMicroseconds();
      int currentPwm4 = myservo4.readMicroseconds();
      int currentPwm5 = myservo5.readMicroseconds();
      
      for (int j = 0; j < 30; j++) {
        int newPwm1 = currentPwm1 + (pwmValue1 - currentPwm1) * (j / 30.0);
        int newPwm2 = currentPwm2 + (pwmValue2 - currentPwm2) * (j / 30.0);
        int newPwm3 = currentPwm3 + (pwmValue3 - currentPwm3) * (j / 30.0);
        int newPwm4 = currentPwm4 + (pwmValue4 - currentPwm4) * (j / 30.0);
        int newPwm5 = currentPwm5 + (pwmValue5 - currentPwm5) * (j / 30.0);

        myservo1.writeMicroseconds(newPwm1);
        myservo2.writeMicroseconds(newPwm2);
        myservo3.writeMicroseconds(newPwm3);
        myservo4.writeMicroseconds(newPwm4);
        myservo5.writeMicroseconds(newPwm5);

        delay(20);
      }
      delay(100);
    }
    currentState6 = 0; // Reset current state
    // shouldStop = false;
  } else{
    Serial.println("No mode");
  }
}

void ACB_CAR_ARM::clearSavedStates() 
{     //clear
  if (ACB_CAR_ARM::mode == 1){
    ACB_CAR_ARM::stateCount1 = 0; //Clear the saved action
    Serial.println("Saved states1 cleared");
  } else if (ACB_CAR_ARM::mode == 2){
    ACB_CAR_ARM::stateCount2 = 0;
    Serial.println("Saved states2 cleared");
  } else if (ACB_CAR_ARM::mode == 3){
    ACB_CAR_ARM::stateCount3 = 0; 
    Serial.println("Saved states3 cleared");
  } else if (ACB_CAR_ARM::mode == 4){
    ACB_CAR_ARM::stateCount4 = 0; 
    Serial.println("Saved states4 cleared");
  } else if (ACB_CAR_ARM::mode == 5){
    ACB_CAR_ARM::stateCount5 = 0; 
    Serial.println("Saved states5 cleared");
  } else if (ACB_CAR_ARM::mode == 6){
    ACB_CAR_ARM::stateCount6 = 0; 
    Serial.println("Saved states6 cleared");
  } else {
    Serial.println("No mode, please select a mode.");
  }
}

int ACB_CAR_ARM::getPositon(char value) {
  
  float zz;
  float yy;
  float xx;

  float theta1 = radians(chassis_angle );
  float theta2 = radians(shoulder_angle -90);
  float theta3 = radians((180-elbow_angle ));

  if ( chassis_angle == 90){
    zz = arm2_length * cos(theta2) + arm3_length * cos(theta2 + theta3);
    yy = arm2_length * sin(theta2) + arm3_length * sin(theta2 + theta3);
    zz = zz + arm1_length;
    xx = 0; 
  } else if ( chassis_angle == 0 ){
    zz = arm2_length * cos(theta2) + arm3_length * cos(theta2 + theta3);
    xx = arm2_length * sin(theta2) + arm3_length * sin(theta2 + theta3);
    zz = zz + arm1_length;
    yy = 0; 
  } else if ( chassis_angle == 180 ){
    zz = arm2_length * cos(theta2) + arm3_length * cos(theta2 + theta3);
    xx = -(arm2_length * sin(theta2) + arm3_length * sin(theta2 + theta3));
    zz = zz + arm1_length;
    yy = 0; 
  } else if ( chassis_angle < 90 ){
    zz = arm2_length * cos(theta2) + arm3_length * cos(theta2 + theta3);
    yy = arm2_length * sin(theta2) + arm3_length * sin(theta2 + theta3);
    zz = zz + arm1_length;
    xx = (90 - chassis_angle) / (90 / sqrt(sq(zz) + sq(yy)));
    yy = yy - ((90 - chassis_angle)/(90/yy));
  } else if ( chassis_angle > 90 ){
    zz = arm2_length * cos(theta2) + arm3_length * cos(theta2 + theta3);
    yy = arm2_length * sin(theta2) + arm3_length * sin(theta2 + theta3);
    zz = zz + arm1_length;
    xx = - ((chassis_angle - 90) / (90 / sqrt(sq(zz) + sq(yy))));
    yy = yy - ((chassis_angle - 90 )/(90/yy));
  }
  
  int rounded_x = round(xx);
  int rounded_y = round(yy);
  int rounded_z = round(zz);

  if (value == 'x'){
    return rounded_x;
  } else if (value == 'y'){
    return rounded_y;
  } else if (value == 'z'){
    return rounded_z;
  }

}


void ACB_CAR_ARM::Ultrasonic_init()
{
  #define Trig_PIN            13
#define Echo_PIN            14 
    pinMode(Trig_PIN, OUTPUT);
    pinMode(Echo_PIN, INPUT);
}

float ACB_CAR_ARM::Ultrasonic_Ranging(int Trig, int Echo) 
{
    digitalWrite(Trig, LOW);
    delayMicroseconds(2);
    digitalWrite(Trig, HIGH);
    delayMicroseconds(10);
    digitalWrite(Trig, LOW);
    float distance = pulseIn(Echo, HIGH) / 58.00;
    delay(10); 
    return distance;
}


void ACB_CAR_ARM::Vehicle_init_V2() 
{
    // 初始化软件串口，指定RX和TX引脚
    v2Serial = new SoftwareSerial(RX_PIN, TX_PIN);
    v2Serial->begin(9600);  // 设置波特率为9600
    motorControl(1, 0);   
    motorControl(2, 0);  
    motorControl(3, 0);  
    motorControl(4, 0); 
}

void ACB_CAR_ARM::motorControl(uint8_t motor, int speed)
{
    if (v2Serial == nullptr) return;  // 安全检查
    
    uint8_t dir ;
    uint8_t speed_value ;
    if(motor == 1 || motor == 2 ){
       dir = speed > 0 ? 1 : 2;
       speed_value = map(abs(speed), 0, 255, 40, 100);
    }

    if(motor == 3 || motor == 4 ){
       dir = speed > 0 ? 2 : 1;
       speed_value = map(abs(speed), 0, 255, 40, 100);
    }

    if(speed == 0)speed_value = 0;
    
    // 使用软件串口发送数据
    v2Serial->write(motor);       // 电机索引
    v2Serial->write(dir);         // 方向 (1:正转, 2:反转)
    v2Serial->write(speed_value); // 速度值 (0-255)
    v2Serial->write('\r');        // 回车
    v2Serial->write('\n');        // 换行
}

void ACB_CAR_ARM::Vehicle_init() 
{
    pinMode(SHCP_PIN, OUTPUT);
    pinMode(EN_PIN, OUTPUT);
    pinMode(DATA_PIN, OUTPUT);
    pinMode(STCP_PIN, OUTPUT);
    pinMode(PWM1_PIN, OUTPUT);
    pinMode(PWM2_PIN, OUTPUT);
}

void ACB_CAR_ARM::Vehicle_Move(int Dir, int Speed) 
{ 
  if (vehicleVersion == 1){
    digitalWrite(EN_PIN, LOW);
    analogWrite(PWM1_PIN, Speed);
    analogWrite(PWM2_PIN, Speed);

    digitalWrite(STCP_PIN, LOW);
    shiftOut(DATA_PIN, SHCP_PIN, MSBFIRST, Dir);
    digitalWrite(STCP_PIN, HIGH);
  }
  if(vehicleVersion == 2){
    
   if(Dir == 163){                       //前进 forward
      motorControl(1, Speed);   
      motorControl(2, Speed);  
      motorControl(3, Speed);  
      motorControl(4, Speed);   
    }

    if(Dir == 92){                        //后退 back
      motorControl(1, -Speed);   
      motorControl(2, -Speed);  
      motorControl(3, -Speed);  
      motorControl(4, -Speed);   
    }

    if(Dir ==  149){                        //右移动 Right
      motorControl(1, Speed);   
      motorControl(2, -Speed);  
      motorControl(3, -Speed);  
      motorControl(4, Speed);   
    }

    if(Dir == 106){                        //左移动 left
      motorControl(1, -Speed);   
      motorControl(2, Speed);  
      motorControl(3, Speed);  
      motorControl(4, -Speed);   
    }

    if(Dir ==  172){                        //顺时针 Counterclockwise rotation
      motorControl(1, Speed);   
      motorControl(2, Speed);  
      motorControl(3, -Speed);  
      motorControl(4, -Speed);   
    }

    if(Dir ==  83){                        //逆时针 Rotate clockwise
      motorControl(1, -Speed);   
      motorControl(2, -Speed);  
      motorControl(3, Speed);  
      motorControl(4, Speed); 
    }

    if(Dir == 34){                        //左上移 Top_Left
      motorControl(1, 0);   
      motorControl(2, Speed);  
      motorControl(3, Speed);  
      motorControl(4, 0);  
    }

    if(Dir ==  129){                        //右上移 Top_Right
      motorControl(1, Speed);   
      motorControl(2, 0);  
      motorControl(3, 0);  
      motorControl(4, Speed);  
    }

    if(Dir == 20){                        // 右下移  Bottom_Right
      motorControl(1, 0);   
      motorControl(2, -Speed);  
      motorControl(3, -Speed);  
      motorControl(4, 0);  
    }

    if(Dir ==  72){                        // 左下移 Bottom_Left
      motorControl(1, -Speed);   
      motorControl(2, 0);  
      motorControl(3, 0);  
      motorControl(4, -Speed);   
    }

    if(Dir == 0){
      motorControl(1, 0);   
      motorControl(2, 0);  
      motorControl(3, 0);  
      motorControl(4, 0);   
    }
  }

}

void ACB_CAR_ARM::Follow() {
  UT_distance = Ultrasonic_Ranging(Trig_PIN, Echo_PIN);
  // Serial.println(UT_distance);
  if (UT_distance < 15) {
    Vehicle_Move(Backward, 200);
  } else if (15 <= UT_distance && UT_distance <= 20) {
    Vehicle_Move(Stop, 0);
  } else if (20 <= UT_distance && UT_distance <= 25) {
    Vehicle_Move(Forward, 180);
  } else if (25 <= UT_distance && UT_distance <= 50) {
    Vehicle_Move(Forward, 220);
  } else {
    Vehicle_Move(Stop, 0);
  }
}

void ACB_CAR_ARM::Track_init(){
  Left_sensor = 35;
  Middle_sensor = 36;
  Right_sensor = 39;
  pinMode(Left_sensor, INPUT);  // Set infrared left sensor pin as input
  pinMode(Middle_sensor, INPUT);  // Set the infrared middle sensor pin as input
  pinMode(Right_sensor, INPUT);  // Set the right infrared sensor pin as input
}

void ACB_CAR_ARM::Track0()      // tracking model1
{
    Left_Tra_Value = analogRead(Left_sensor);
    //Middle_Tra_Value = analogRead(Middle_sensor);
    Right_Tra_Value = analogRead(Right_sensor);
    //Serial.println(Left_Tra_Value);
    delay(5);
    if (Left_Tra_Value < Black_Line && Right_Tra_Value < Black_Line)
    {
        Vehicle_Move(Forward, 130);
    }
    else if (Left_Tra_Value >= Black_Line && Right_Tra_Value < Black_Line)
    {
        Vehicle_Move(Contrarotate, 150);
    }
    else if (Left_Tra_Value < Black_Line && Right_Tra_Value >= Black_Line)
    {
        Vehicle_Move(Clockwise, 150);
    }
    else if (Left_Tra_Value >= Black_Line && Left_Tra_Value < Off_Road && Right_Tra_Value >= Black_Line && Right_Tra_Value < Off_Road)
    {
        Vehicle_Move(Stop, 0);
    }
    else if (Left_Tra_Value >= Off_Road && Right_Tra_Value >= Off_Road)
    {
        Vehicle_Move(Stop, 0);
    }
}

void ACB_CAR_ARM::Track(){
    Left_Tra_Value = analogRead(Left_sensor);
    Middle_Tra_Value = analogRead(Middle_sensor);
    Right_Tra_Value = analogRead(Right_sensor);
    if (Left_Tra_Value >= Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value < Black_Line)
    {
        Vehicle_Move(Forward, 180);
        return;
    }
    /*else if (Left_Tra_Value >= Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value < Black_Line)
    {
        Acebott.Move(Contrarotate, 150);
    }*/
    else if (Left_Tra_Value >= Black_Line && Middle_Tra_Value < Black_Line && Right_Tra_Value < Black_Line)
    {
        Vehicle_Move(Contrarotate, 220);
        return;
    }
    else if (Left_Tra_Value < Black_Line && Middle_Tra_Value < Black_Line && Right_Tra_Value >= Black_Line)
    {
        Vehicle_Move(Clockwise, 220);
        return;
    }
    /*else if (Left_Tra_Value < Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value >= Black_Line)
    {
        Acebott.Move(Clockwise, 150);
    }*/
    /*else if (Left_Tra_Value >= Black_Line && Left_Tra_Value < Off_Road && Middle_Tra_Value >= Black_Line && Middle_Tra_Value < Off_Road && Right_Tra_Value >= Black_Line && Right_Tra_Value < Off_Road)
    {
        Acebott.Move(Forward, 180);
    }*/
    else if (Left_Tra_Value >= Off_Road && Middle_Tra_Value >= Off_Road && Right_Tra_Value >= Off_Road)
    {
        Vehicle_Move(Stop, 0);
        return;
    }
    if (Left_Tra_Value < Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value < Black_Line)
    {
        Vehicle_Move(Forward, 180);
        return;
    }
    if (Left_Tra_Value < Black_Line && Middle_Tra_Value >= Black_Line && Right_Tra_Value >= Black_Line)
    {
        Vehicle_Move(Forward, 180);
        return;
    }
}

void ACB_CAR_ARM::Avoid(){
  
  UT_distance = Ultrasonic_Ranging(Trig_PIN, Echo_PIN);
  middleDistance = UT_distance;
  Serial.println(middleDistance);
  if (middleDistance <= 25) {
    Vehicle_Move(Stop, 0);
    delay(100);
    int randNumber = random(1, 4);
    switch (randNumber) {
      case 1:
        Vehicle_Move(Backward, 180);
        delay(500);
        Vehicle_Move(Move_Left, 180);
        delay(500);
        break;
      case 2:
        Vehicle_Move(Clockwise, 180);
        delay(1000);
        break;
      case 3:
        Vehicle_Move(Contrarotate, 180);
        delay(1000);
        break;
      case 4:
        Vehicle_Move(Backward, 180);
        delay(500);
        Vehicle_Move(Move_Right, 180);
        delay(500);
        break;
    }
  } else {
    Vehicle_Move(Forward, 180);
  }
}

void ACB_CAR_ARM::forward(int value)
{
    _speed = value;
    Vehicle_Move(Forward, _speed);
}
void ACB_CAR_ARM::backward(int value)
{
    _speed = value;
    Vehicle_Move(Backward, _speed);
}
void ACB_CAR_ARM::left(int value)
{
    _speed = value;
    Vehicle_Move(Move_Left, _speed);
}
void ACB_CAR_ARM::right(int value)
{
    _speed = value;
    Vehicle_Move(Move_Right, _speed);
}
void ACB_CAR_ARM::anticlockwise(int value)
{
    _speed = value;
    Vehicle_Move(Contrarotate, _speed);
}
void ACB_CAR_ARM::clockwise(int value)
{
    _speed = value;
    Vehicle_Move(Clockwise, _speed);
}
void ACB_CAR_ARM::leftUp(int value)
{
    _speed = value;
    Vehicle_Move(Top_Left, _speed);
}
void ACB_CAR_ARM::rightUp(int value)
{
    _speed = value;
    Vehicle_Move(Top_Right, _speed);
}
void ACB_CAR_ARM::leftDown(int value)
{
    _speed = value;
    Vehicle_Move(Bottom_Left, _speed);
}
void ACB_CAR_ARM::rightDown(int value)
{
    _speed = value;
    Vehicle_Move(Bottom_Right, _speed);
}
void ACB_CAR_ARM::stop()
{
    Vehicle_Move(Stop, 0);
}
void ACB_CAR_ARM::CARspeed(int value)
{
    _speed = value;
}

void ACB_CAR_ARM::parseData()
{
    isStart = false;
    int action = readBuffer(9);
    int device = readBuffer(10);
    int vals = readBuffer(12);
    int Speeds = readBuffer(12);
    int RGB_Val_Temp = readBuffer(12);
    int _action = readBuffer(3);  //硬件ID
    int _device = readBuffer(4);  //命令ID
    if (action == 1 && device == 12)
    {
        switch (vals)
        {
        case 0:
            ACB_CAR_ARM::val = 60;  // stop
            break;
        case 1:
            ACB_CAR_ARM::val = 63;  // forward
            break;
        case 2:
            ACB_CAR_ARM::val = 65;  // backward
            break;
        case 3:
            ACB_CAR_ARM::val = 61;  // left 
            break;
        case 4:
            ACB_CAR_ARM::val = 62; // right
            break;
        case 9:
            ACB_CAR_ARM::val = 64; // anticlockwise
            break;
        case 10:
            ACB_CAR_ARM::val = 66; // clockwise
            break;
        case 5:
            ACB_CAR_ARM::val = 74; // LeftUp
            break;
        case 6:
            ACB_CAR_ARM::val = 71; // LeftDown
            break;
        case 7:
            ACB_CAR_ARM::val = 72; // RightUp
            break;
        case 8:
            ACB_CAR_ARM::val = 73; // RightDown
         
            break;
        }
    }

    if (action == 1 && device == 13)
    {
        ACB_CAR_ARM::val = 58; 
        Car_Speed = Speeds;
    }

    if (action == 1 && device == 2)
    {
        ACB_CAR_ARM::val = 81;   // servo 
        SliderAngle = vals;
        Camera_servo_angles = vals;
    }

    if (action == 1 && device == 5)
    {
        if (vals == 1){
          ACB_CAR_ARM::val = 82;  // led open
        } else {
          ACB_CAR_ARM::val = 83;  // led close
        }
    }

    if (action == 1 && device == 8)
    {
      ACB_CAR_ARM::val = 99;
    }

    if (action == 1 && device == 3)
    {
        if (vals == 1){
          ACB_CAR_ARM::val = 84;  // buzzer1
        } else if (vals == 2){
          ACB_CAR_ARM::val = 85;  // 2
        } else if (vals == 3){
          ACB_CAR_ARM::val = 86;  // 3
        } else if (vals == 4){
          ACB_CAR_ARM::val = 87;  // 4
        } else if(vals == 0){
          ACB_CAR_ARM::val = 3;  // 0
        }
    }

    if (action == 4)
    {
        ACB_CAR_ARM::val = 67;  // track 1
    }

    if (action == 5)
    {
        ACB_CAR_ARM::val = 59;  // track 0
    }

    if (action == 6)
    {
        ACB_CAR_ARM::val = 69;  // avoid
    }

    if (action == 7)
    {
        ACB_CAR_ARM::val = 68;  // follow
    }

    if (action == 3)
    {
        ACB_CAR_ARM::val = 60;  // stop
    }

    if (action == 1 && device == 8)
    {
        ACB_CAR_ARM::val = 88;   // shooting
    }
/******************************************* new 2025-5-24 **************************************** */
    if (action == 1 && device == 30)
    {
        ACB_CAR_ARM::val = 89;   // 二维码识别
    }

    if (action == 1 && device == 31)
    {
        ACB_CAR_ARM::val = 90;   // 条形码识别
    }

    if (action == 1 && device == 32)
    {
        ACB_CAR_ARM::val = 91;   // 数字识别
    }

    if (action == 1 && device == 33)
    {
        ACB_CAR_ARM::val = 92;   // 颜色识别
    }

    if (action == 1 && device == 34)
    {
        ACB_CAR_ARM::val = 93;   // 图像识别
    }

    if (action == 1 && device == 35)
    {
        if(readBuffer(12) == 1) ACB_CAR_ARM::val = 94;   // 颜色跟踪
          else if(readBuffer(12) == 2) ACB_CAR_ARM::val = 96;   // 颜色跟踪
            else if(readBuffer(12) == 3) ACB_CAR_ARM::val = 95;   // 颜色跟踪
    }

    if (action == 1 && device == 36)
    {
        ACB_CAR_ARM::val = 97;   // 视觉巡线
    }

    if (action == 1 && device == 37)
    {
        ACB_CAR_ARM::val = 98;   // 交通识别
    }

    if (action == 1 && device == 38)
    {
        ACB_CAR_ARM::val = 99;   // 机器学习
    }

    if (action == 1 && device == 39)
    {
        ACB_CAR_ARM::val = 100;   // 人脸识别
    }

    if (action == 1 && device == 40)
    {
        if(readBuffer(12) == 1)ACB_CAR_ARM::val = 101;   // 拍照按钮
          else ACB_CAR_ARM::val = 3;   // 拍照按钮
    }

    if (action == 1 && device == 50)
    {
        ACB_CAR_ARM::val = 3;   // 关闭
    }
   /*******************************************************************************************************/
    if (action == 1 && device == 41)
    {
        RGB_Red_Val = readBuffer(12);
    }

    if (action == 1 && device == 42)
    {
        RGB_Blue_Val = readBuffer(12);
    }

    if (action == 1 && device == 43)
    {
        RGB_Green_Val = readBuffer(12);
    }
    /***********************************************new 2026-12-6（16*8屏幕）***********************************************/
    if(_action == 1 && _device == 1){
      g_screen_pattern = (uint8_t)readBuffer(5);
      ACB_CAR_ARM::val = 102;
    }

    if(_action == 1 && _device == 2){
      for (int i = 0; i < 16; i++) {
        g_screen_data[i] = (uint8_t)readBuffer(5 + i);
      }
      ACB_CAR_ARM::val = 103;
    }
    if(_action == 1 && _device == 3){
      ;
    }
    /********************************************MP3***********************************************/
     if(_action == 4&&_device == 0){//上一首
      g_mp3_cmd = _device;
      ACB_CAR_ARM::val = 104;
    }

     if(_action == 4&&_device == 1){//下一首
      g_mp3_cmd = _device;
      ACB_CAR_ARM::val = 105;
    }

     if(_action == 4&&_device == 2){//启动
      g_mp3_cmd = _device;
      ACB_CAR_ARM::val = 106;
    }
    

    if(_action == 4&&_device == 3){//暂停
      g_mp3_cmd = _device;
      ACB_CAR_ARM::val = 107;
    }

 
    if(_action == 4&&_device == 4){//音量
      g_mp3_volume   = (uint8_t)readBuffer(5);
      ACB_CAR_ARM::val = 108;
    }
}
/************************************************************************************/
void ACB_CAR_ARM::CarMove()
{
  if (ACB_CAR_ARM::val==60) 
  {
    Vehicle_Move(Stop, 0);
  } 
  
  else if (ACB_CAR_ARM::val==61) 
  {
    Vehicle_Move(Move_Left, Car_Speed);
  } 
  
  else if (ACB_CAR_ARM::val==62) 
  {
    Vehicle_Move(Move_Right, Car_Speed);
  } 
  
  else if (ACB_CAR_ARM::val==63) 
  {
    Vehicle_Move(Forward, Car_Speed); 
  } 
  
  else if (ACB_CAR_ARM::val==64) 
  {
    Vehicle_Move(Contrarotate, Car_Speed);   // turn left
  } 
  
  else if (ACB_CAR_ARM::val==65) {
    Vehicle_Move(Backward, Car_Speed);
  } 
  
  else if (ACB_CAR_ARM::val==66) 
  {
    Vehicle_Move(Clockwise, Car_Speed);    // turn right
  } 
  delay(10);
}

void ACB_CAR_ARM::Shoot_init(int Shoot_PIN)
{
  Shoot_PINS = Shoot_PIN;
  pinMode(Shoot_PINS, OUTPUT);    // 设置射击引脚为输出
}

void ACB_CAR_ARM::Shoot()
{
  digitalWrite(Shoot_PINS, HIGH);
  delay(200);
  digitalWrite(Shoot_PINS, LOW);
}

void ACB_CAR_ARM::Shoot_open()
{
  digitalWrite(Shoot_PINS, HIGH);
}

void ACB_CAR_ARM::Shoot_close()
{
  digitalWrite(Shoot_PINS, LOW);
}

void ACB_CAR_ARM::Camera_servo(int TURN_SERVO_PIN)
{
  turnServo.attach(TURN_SERVO_PIN);   // 连接舵机到TURN_SERVO_PIN引脚
  turnServo.write(90);         // 设置舵机角度为angle

}

void ACB_CAR_ARM::Servo_move(int Camera_servo_angle)
{
  int pwmValue = map(Camera_servo_angle, 1, 180, 130, 70);
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

void ACB_CAR_ARM::Esp32CarLoop() {
  if (Serial.available() > 0) {
    unsigned char c = Serial.read() & 0xff;
    //Serial.write(c);
    if (c == 0x55 && isStart == false) {
      if (prevc == 0xff) {
        index_a = 1;
        isStart = true;
      }
    } else {
      prevc = c;
      if (isStart) {
        if (index_a == 2) {
          dataLen = c;
        } else if (index_a > 2) {
          dataLen--;
        }
        writeBuffer(index_a, c);
      }
    }
    index_a++;
    if (index_a > 120) {
      index_a = 0;
      isStart = false;
    }
    if (isStart && dataLen == 0 && index_a > 3) {
      isStart = false;
      parseData();
      index_a = 0;
    }
    // functionMode();
  }
}

void ACB_CAR_ARM::Carloop(){
  client = server->available();
    if (client)
    {
        WA_en = true;
        ED_client = true;
        unsigned long previousMillis = millis();  // 上一个检查时间
        const unsigned long timeoutDuration = 2000;  // 超时时间（2秒）
        while (client.connected())
        {
            if ((millis() - previousMillis) > timeoutDuration && client.available() == 0 && st==true)
            {
              break;
            }  

            if (client.available())
            {
                previousMillis = millis();
                unsigned char c = client.read() & 0xff;
                // Serial.write(c);

                st = false;
                if (c == 200)
                {
                  st = true;
                }
                
                if (c == 0x55 && isStart == false)
                {
                    if (prevc == 0xff)
                    {
                        index_a = 1;
                        isStart = true;
                    }
                }
                else
                {
                    prevc = c;
                    if (isStart)
                    {
                        if (index_a == 2)
                        {
                            dataLen = c;
                        }
                        else if (index_a > 2)
                        {
                            dataLen--;
                        }
                        writeBuffer(index_a, c);
                    }
                }
                index_a++;
                if (index_a > 120)
                {
                    index_a = 0;
                    isStart = false;
                }
                if (isStart && dataLen == 0 && index_a > 3)
                {
                    isStart = false;
                    parseData();
                    index_a = 0;
                }
            }

            if (Serial.available())
            {
                char c = Serial.read();
                sendBuff += c;
                client.print(sendBuff);
                // Serial.print(sendBuff);
                sendBuff = "";
            }
        }
        client.stop();
        ACB_CAR_ARM::val = 3;
    }
    else
    {
        if (ED_client == true)
        {
            ED_client = false;
        }
    }
}
/******************************************* new 2025-5-24 **************************************** */
void ACB_CAR_ARM::sendCommand(const char* cmd) {

    while(Serial.available() > 0) {
        Serial.read();
        }


    Serial.write(cmd);  // 发送命令
    delay(400);         // 等待 OpenMV 执行

}

void ACB_CAR_ARM::Exit_task(){

    while (1){

        sendCommand("Wait_response"); 

        delay(500);
    
        if (Serial.available()) {
    
            String direction = Serial.readStringUntil('\n');
            direction.trim(); 
            Start = 0;
    
            if(direction == "Success" ){
    
                break;
            }
            
            }
        }
    
}

void ACB_CAR_ARM::lcd_init()
{

    Serial.println(Start);

    while (Start){

    sendCommand("Wait_response"); 
    delay(500);

    if (Serial.available()) {

        String direction = Serial.readStringUntil('\n');
        direction.trim(); 
        Start = 0;

        if(direction == "Success" ){

            break;
        }
        
        }
    }

    sendCommand("lcd:init"); 
    delay(400);
}


void ACB_CAR_ARM::lcd_rotation(int dir)  // 0 1 2 3
{
    if (dir == 0)
    {
        sendCommand("lcd:rotation0\n"); 
    }

    else if (dir == 1)
    {
        sendCommand("lcd:rotation1\n"); 
    }

    else if (dir == 2)
    {
        sendCommand("lcd:rotation2\n"); 
    }

    else if (dir == 3)
    {
        sendCommand("lcd:rotation3\n"); 
    }

    delay(2000);
}

void ACB_CAR_ARM::lcd_ROI(int x, int y, int w, int h) {
   
    x = (x / 8) * 8;  
    y = (y / 8) * 8;
    w = (w / 8) * 8;
    h = (h / 8) * 8;

    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (w > 320) w = 320;
    if (h > 240) h = 240;
    if (x + w > 320) w = 320 - x;  // 防止越界
    if (y + h > 240) h = 240 - y;

    String command = "lcd:ROI:" + String(x) + ":" + String(y) + ":" + String(w) + ":" + String(h);

    Serial.println(command);

    delay(100);
}

void ACB_CAR_ARM::lcd_move(int x, int y){

    uint8_t data[4]; 
    data[0] = (x >> 8) & 0xFF; 
    data[1] = x & 0xFF;        
    data[2] = (y >> 8) & 0xFF;
    data[3] = y & 0xFF;
    Serial.write(data, sizeof(data));

    delay(400);
}

void ACB_CAR_ARM::lcd_zoom(float zoom_factor) {
    // 限制缩放范围（如 1.0 ~ 4.0，具体取决于摄像头支持）
    zoom_factor = constrain(zoom_factor, 1.0, 4.0);  // 假设最大 4 倍变焦

    // 构造字符串命令，格式："lcd:zoom:zoom_factor"
    String command = "lcd:zoom:" + String(zoom_factor, 1);  // 保留 1 位小数

    // 发送命令
    Serial.println(command);

    // 延时确保命令执行完成
    delay(100);
}

void ACB_CAR_ARM::lcd_flip(int state )
{
    if(state)sendCommand("lcd:flip_open"); 
     else sendCommand("lcd:flip_close"); 
    
    delay(400);

}

void ACB_CAR_ARM::camera_init()
{

    while (Start){

        sendCommand("Wait_response"); 
        delay(500);

        if (Serial.available()) {

            String direction = Serial.readStringUntil('\n');
            direction.trim();  // 修正变量名
            Start = 0;
            
            if(direction == "Success" ){

                Serial.println(direction);
                break;
            }
            
            }
        }

    sendCommand("camera:init");
    delay(400);
}

void ACB_CAR_ARM::camera_framsize(String framsize)
{
    if (framsize == "QVGA")
    {
        sendCommand("camera:framsize0");
    }
    else if (framsize == "QQVGA")
    {
        sendCommand("camera:framsize1");
    }
    delay(2000);
}

void ACB_CAR_ARM::camera_state(String state)
{
    if (state == "open")
    {
        sendCommand("camera:open");
    }
    else if (state == "close")
    {
        sendCommand("camera:close");
    }
    delay(500);
}

void ACB_CAR_ARM::camera_display(){
   sendCommand("camera:display");
   delay(1);
}

void ACB_CAR_ARM::barcode_recognize(){
   sendCommand("barcode:recognize");
   delay(1);
}

void ACB_CAR_ARM::qrcode_recognize(){
   sendCommand("qrcode:recognize");
   delay(1);
}

void ACB_CAR_ARM::kpu_init(String kpu_address){
   String command = "kpu_init:" + kpu_address;  // 拼接字符串
   sendCommand(command.c_str());
   delay(1);
}

void ACB_CAR_ARM::kpu_deinit(){
   sendCommand("kpu_deinit:deinit");
   delay(1);
}

void ACB_CAR_ARM::number_recognize(){
   sendCommand("number:recognize");
   delay(1);
}

void ACB_CAR_ARM::color_recognize(){
    sendCommand("color:recognize");
    delay(400);
}

void ACB_CAR_ARM::color_appoint_recognize(String color){
    if (color == "red") {
        sendCommand("color:red");
    } else if (color == "green") {
        sendCommand("color:green");
    } else if (color == "blue") {
        sendCommand("color:blue");
    }
    delay(400);
}
 
void ACB_CAR_ARM::face_recognize() {
    sendCommand("face:recognize");
    delay(400);
}

void ACB_CAR_ARM::face_graphical() {
    sendCommand("face:graphical");
    delay(400);
}

void ACB_CAR_ARM::tacking_open() {
    sendCommand("tacking:open");
    delay(400);
}

void ACB_CAR_ARM::tacking_graphical() {
    sendCommand("tacking:graphical");
    delay(400);
}

void ACB_CAR_ARM::image_recognize() {
    sendCommand("image:recognize");
    delay(400);
}

void ACB_CAR_ARM::Traffic_identification(){   
    delay(1500);
    sendCommand("traffic:recognize");   
}

void ACB_CAR_ARM::Traffic_graphical(){   
    delay(400);
    sendCommand("traffic:graphical");   
    delay(400);
}

void ACB_CAR_ARM::machine_learning(){
    sendCommand("machine:learning");
    delay(400);

}
void ACB_CAR_ARM::photo_program(){
    sendCommand("photo:program");
    delay(400);
    
}

void ACB_CAR_ARM::GRB_red(char red){

  Serial.print("red: ");
  delay(100);
}

void ACB_CAR_ARM::GRB_green(char green){

  Serial.print("green: ");
  delay(100);
   
}

void ACB_CAR_ARM::GRB_blue(char blue){
  
  Serial.print("blue: ");
  delay(100);
   
}

String ACB_CAR_ARM::Visual_data() {
    if (Serial.available()) {
        String direction = Serial.readStringUntil('\n');
        direction.trim();  // 修正变量名
        return direction;
    }
    return "";  // 没有数据时返回空字符串
}

void ACB_CAR_ARM::received_data() {
    if (Serial.available()) {
    
        String received_data = Serial.readStringUntil('\n');
        received_data.trim();
        // 解析实现
        int params[4];
        char Buf[20] = {0};
        int parsed = sscanf(received_data.c_str(), "%d,%d,%d,%d,%19s", 
                           &params[0], &params[1], &params[2], &params[3], Buf);

        x = params[0];
        y = params[1];
        w = params[2];
        h = params[3];
        tag = String(Buf);   
        
    }

    delay(100);
}


//*************************Web_Processing*************************
static esp_err_t cmd_handler(httpd_req_t *req) {
    char*  buf;
    size_t buf_len;
    char variable[32] = {0,};
    char value[32] = {0,};
    char s1_value[32] = {0,};
    char s2_value[32] = {0,};
    char s3_value[32] = {0,};
    char s4_value[32] = {0,};
    char s5_value[32] = {0,};

    buf_len = httpd_req_get_url_query_len(req) + 1;
    if (buf_len > 1) {
        buf = (char*)malloc(buf_len);
        if(!buf){
            httpd_resp_send_500(req);
            return ESP_FAIL;
        }
        if (httpd_req_get_url_query_str(req, buf, buf_len) == ESP_OK) {
          // Serial.println(buf);
            if ((httpd_query_key_value(buf, "var", variable, sizeof(variable)) == ESP_OK &&
                httpd_query_key_value(buf, "val", value, sizeof(value)) == ESP_OK &&
                httpd_query_key_value(buf, "s1", s1_value, sizeof(s1_value)) == ESP_OK &&
                httpd_query_key_value(buf, "s2", s2_value, sizeof(s2_value)) == ESP_OK &&
                httpd_query_key_value(buf, "s3", s3_value, sizeof(s3_value)) == ESP_OK) ||
                (httpd_query_key_value(buf, "var", variable, sizeof(variable)) == ESP_OK &&
                httpd_query_key_value(buf, "val", value, sizeof(value)) == ESP_OK &&
                httpd_query_key_value(buf, "s1", s1_value, sizeof(s1_value)) == ESP_OK ) ||
                (httpd_query_key_value(buf, "var", variable, sizeof(variable)) == ESP_OK &&
                httpd_query_key_value(buf, "val", value, sizeof(value)) == ESP_OK &&
                httpd_query_key_value(buf, "s2", s2_value, sizeof(s2_value)) == ESP_OK ) ||
                (httpd_query_key_value(buf, "var", variable, sizeof(variable)) == ESP_OK &&
                httpd_query_key_value(buf, "val", value, sizeof(value)) == ESP_OK &&
                httpd_query_key_value(buf, "s3", s3_value, sizeof(s3_value)) == ESP_OK ) ||
                (httpd_query_key_value(buf, "var", variable, sizeof(variable)) == ESP_OK &&
                httpd_query_key_value(buf, "val", value, sizeof(value)) == ESP_OK &&
                httpd_query_key_value(buf, "s4", s4_value, sizeof(s4_value)) == ESP_OK ) ||
                (httpd_query_key_value(buf, "var", variable, sizeof(variable)) == ESP_OK &&
                httpd_query_key_value(buf, "val", value, sizeof(value)) == ESP_OK &&
                httpd_query_key_value(buf, "s5", s5_value, sizeof(s4_value)) == ESP_OK ) ||            
                (httpd_query_key_value(buf, "var", variable, sizeof(variable)) == ESP_OK &&
                httpd_query_key_value(buf, "val", value, sizeof(value)) == ESP_OK)){
            } else {
                free(buf);
                httpd_resp_send_404(req);
                return ESP_FAIL;
            }
        } else {
            free(buf);
            httpd_resp_send_404(req);
            return ESP_FAIL;
        }
        free(buf);
    } else {
        httpd_resp_send_404(req);
        return ESP_FAIL;
    }

    ACB_CAR_ARM::val = atoi(value);
    ACB_CAR_ARM::Chassis_Silde_Angle = atoi(s1_value);
    ACB_CAR_ARM::Shoulder_Silde_Angle = atoi(s2_value);
    ACB_CAR_ARM::Elbow_Silde_Angle = atoi(s3_value);
    ACB_CAR_ARM::Claws_Silde_Angle = atoi(s4_value);
    ACB_CAR_ARM::Wrist_Silde_Angle = atoi(s5_value);

    ACB_CAR_ARM::PTP_X = atoi(s1_value);
    ACB_CAR_ARM::PTP_Y = atoi(s2_value);
    ACB_CAR_ARM::PTP_Z = atoi(s3_value);

    int res = 0;
    
    if(!strcmp(variable, "car")) {  
      
      if ( ACB_CAR_ARM::val == 41 ){
        if ( ACB_CAR_ARM::stateCount1 == 0){
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "0";
          return httpd_resp_send(req, response_data, strlen(response_data));
        } else {
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data));
        }  
      }

      if ( ACB_CAR_ARM::val == 42 ){
        if ( ACB_CAR_ARM::stateCount2 == 0){
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "0";
          return httpd_resp_send(req, response_data, strlen(response_data));
        } else {
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data));
        }  
      }

      if ( ACB_CAR_ARM::val == 43 ){
        if ( ACB_CAR_ARM::stateCount3 == 0){
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "0";
          return httpd_resp_send(req, response_data, strlen(response_data));
        } else {
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data));
        }  
      }

      if ( ACB_CAR_ARM::val == 44 ){
        if ( ACB_CAR_ARM::stateCount4 == 0){
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "0";
          return httpd_resp_send(req, response_data, strlen(response_data));
        } else {
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data));
        }  
      }

      if ( ACB_CAR_ARM::val == 45 ){
        if ( ACB_CAR_ARM::stateCount5 == 0){
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "0";
          return httpd_resp_send(req, response_data, strlen(response_data));
        } else {
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data));
        }  
      }

      if ( ACB_CAR_ARM::val == 46 ){
        if ( ACB_CAR_ARM::stateCount6 == 0){
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "0";
          return httpd_resp_send(req, response_data, strlen(response_data));
        } else {
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data));
        }  
      }
  
      if ( ACB_CAR_ARM::val == 31 ){
          httpd_resp_set_type(req, "text/plain");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data)); 

      }

      if ( ACB_CAR_ARM::val == 35 ){
          httpd_resp_set_type(req, "text/html");
          const char *response_data = "1";
          return httpd_resp_send(req, response_data, strlen(response_data)); 
      }

    } else { 
      // Serial.println("variable");
      res = -1; 
    }

    if(res){ return httpd_resp_send_500(req); }

    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, NULL, 0);
}


//*************************Web_HTML*************************
static const char PROGMEM INDEX_HTML[] = R"rawliteral(
<!doctype html>
<html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>ACEBOTT QD001 ESP32 ROBOT CAR ARM</title>
          <style>

            html {
              touch-action:none;

              touch-action:pan-y;
            }

            body {
              -webkit-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
              user-select: none;
              
            }

            input[type=range] {
                -webkit-appearance: none;
                width: 80%;
                height: 10px;
                background: #ccc;
                cursor: pointer;
                margin: 10px;
            }

            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 20px;
                height: 20px;
                background: #ff3034;
                cursor: pointer;
                border-radius: 50%;
            }

              *{
                  padding: 0; margin: 0;
                  font-family:monospace;
              }

              *{  
                  -webkit-touch-callout:none;  
                  -webkit-user-select:none;  
                  -khtml-user-select:none;  
                  -moz-user-select:none;  
                  -ms-user-select:none;  
                  user-select:none;  
              }

          canvas {
          margin: auto;
          display: block;

          }
          .tITULO{
              text-align: center;
              color: rgb(97, 97, 97);
              
          }
          .LINK{
              color: red;
              width: 60px;
              margin: auto;
              display: block;
              font-size: 14px;
          }
          .cont_flex{
              margin: 20px auto 20px;
              width: 70%;
              max-width: 400px;
              display: flex;
              flex-wrap: wrap;
              justify-content: space-around;
          }
          .cont_flex4{
              margin: 20px auto 20px;
              width: 70%;
              max-width: 400px;
              display: flex;
              flex-wrap: wrap;
              justify-content: space-around;
          }
          .cont_flex4 button{
              width: 80px;
              height: 35px;
              border: none;
              background-color: #3D9EFF;
              border-radius: 10px;
              color: white;

          }
          .cont_flex5{
              margin: 15px auto 5px;
              width: 100%;
              max-width: 400px;
              display: flex;
              flex-wrap: wrap;
              justify-content: space-around;
          }
          .cont_flex5 button{
              width: 280px;
              height: 35px;
              border: none;
              background-color: #3D9EFF;
              border-radius: 10px;
              color: white;

          }
          .cont_flex button{
              width: 80px;
              height: 35px;
              border: none;
              background-color: #0080FF;
              border-radius: 10px;
              color: white;

          }
          .cont_flex button:active{
              background-color: green;
          }
          .cont_flex4 button:active{
              background-color: green;
          }

          .cont_flex1{
              margin: 20px auto 20px;
              width: 70%;
              max-width: 400px;
              display: flex;
              flex-wrap: wrap;
              justify-content: space-around;
          }
          .cont_flex1 button{
              width: 55px;
              height: 30px;
              border: none;
              background-color: #0080FF;
              border-radius: 10px;
              color: white;

          }
          .cont_flex1 button:active{
              background-color: green;
          }

          .cont_flex3 {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .slider_container {
            padding-top: 5px; 
          }

          .slider_container1 {
              padding-left: 10px; 
          }

          .cont_flex_hua {
              margin: 20px auto 20px;
              width: 85%;
              max-width: 1000px;
              display: flex;
              flex-wrap: wrap;
              justify-content: space-around;
          }
          .cont_flex_hua p {
              flex: 0 0 auto; 
              width: 65px; 
              margin: 5px;
              box-sizing: border-box;
              padding-bottom: 3px;
          }
          .cont_flex_hua input {
              flex: 1 1 auto;
              box-sizing: border-box;
          }
          @media screen and (max-width: 600px) {
              .cont_flex_hua .input_wrapper {
                  width: 100%;
              }
          }

          .custom-alert {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: lightskyblue;
            padding: 20px;
            border: 1px solid gray;
            border-radius: 5px;
            animation: fadeInOut 2s ease-in-out forwards;
            opacity: 0; 
            visibility: hidden; 
            }

          input{-webkit-user-select:auto;} 
          input[type=range]{-webkit-appearance:none;width:300px;height:25px;background:#cecece;cursor:pointer;margin:0}
          input[type=range]:focus{outline:0}
          input[type=range]::-webkit-slider-runnable-track{width:100%;height:2px;cursor:pointer;background:#EFEFEF;border-radius:0;border:0 solid #EFEFEF}
          input[type=range]::-webkit-slider-thumb{border:1px solid rgba(0,0,30,0);height:22px;width:22px;border-radius:50px;background:#ff3034;cursor:pointer;-webkit-appearance:none;margin-top:-10px}

          </style>
      </head>
      <body>
          <div id="customAlert" class="custom-alert">
            <p id="alertText" style="color: white; font-size: 15px;"></p>
          </div>

          <p style="color: black; display: flex; justify-content: center; align-items: center; font-size: 25px;">Smart Car</p>   

          <div class="cont_flex4">     
              <button type="button" id="Turn_Left" ontouchstart="fetch(document.location.origin+'/control?var=car&val=64');"ontouchend="fetch(document.location.origin+'/control?var=car&val=60');">Turn Left</button>

              <button type="button" id="UP" ontouchstart="fetch(document.location.origin+'/control?var=car&val=63');"ontouchend="fetch(document.location.origin+'/control?var=car&val=60');">Forward</button>

              <button type="button" id="Turn_Right" ontouchstart="fetch(document.location.origin+'/control?var=car&val=66');"ontouchend="fetch(document.location.origin+'/control?var=car&val=60');">Turn Right</button>
          </div>

          <div class="cont_flex4">     
              <button type="button" id="Left" ontouchstart="fetch(document.location.origin+'/control?var=car&val=61');"ontouchend="fetch(document.location.origin+'/control?var=car&val=60');">Left</button>

              <button type="button" id="Down" ontouchstart="fetch(document.location.origin+'/control?var=car&val=65');"ontouchend="fetch(document.location.origin+'/control?var=car&val=60');">Backward</button>

              <button type="button" id="Right" ontouchstart="fetch(document.location.origin+'/control?var=car&val=62');"ontouchend="fetch(document.location.origin+'/control?var=car&val=60');">Right</button> 
          </div>

          <div class="cont_flex4">     
              <button type="button" id="Turn_Left" ontouchstart="fetch(document.location.origin+'/control?var=car&val=59');" >Track</button>

              <button type="button" id="UP" ontouchstart="fetch(document.location.origin+'/control?var=car&val=68');">Follow</button>

              <button type="button" id="Turn_Right" ontouchstart="fetch(document.location.origin+'/control?var=car&val=69');">Avoidance</button>

              <div class="cont_flex5">  
                <button type="button" id="Stop" ontouchstart="fetch(document.location.origin+'/control?var=car&val=60');"ontouchend="fetch(document.location.origin+'/control?var=car&val=3');">Stop</button>
              </div>
              
          </div>

          <div style="display: flex; justify-content: center; align-items: center;">

              <p style="color: black;">Claws &nbsp; :</p>
              <input type="range" style="width: 200px;" id="slider4" min="90" max="180" value="90" ontouchend="fetch(document.location.origin+'/control?var=car&val=3');" oninput="sendSliderValue44();" onmousedown="sendSliderValue44();" onchange="updateValue4(this.value);">
                
              <p id="sliderValue4" style="color: black; width: 25px; margin-left: 10px;" >90</p>
              <input type="text" id="inputValue4" onblur="checkEnter4(event)" style="width:80px;" placeholder="Enter Value" title="Enter a number between 90°and 180°">
          </div>

          <div style="display: flex; justify-content: center; align-items: center; padding-top: 10px;" >
              <p style="color: black;">Wrist &nbsp; :</p>
              <input type="range" style="width: 200px;" id="slider5" min="0" max="180" value="90" ontouchend="fetch(document.location.origin+'/control?var=car&val=3');" oninput="sendSliderValue55();" onmousedown="sendSliderValue55();" onchange="updateValue5(this.value);">
              
              <p id="sliderValue5" style="color: black; width: 25px; margin-left: 10px;" >90</p>
              <input type="text" id="inputValue5" onblur="checkEnter5(event)" style="width:80px;" placeholder="Enter Value" title="Enter a number between 0°and 180°">
          </div>

          <div style="display: flex; justify-content: center; align-items: center; padding-top: 10px;" >
              <p style="color: black;">Elbow &nbsp; :</p>
              <input type="range" style="width: 200px;" id="slider3" min="0" max="180" value="90" ontouchend="fetch(document.location.origin+'/control?var=car&val=3');" oninput="sendSliderValue33();" onmousedown="sendSliderValue33();" onchange="updateValue3(this.value);">
              
              <p id="sliderValue3" style="color: black; width: 25px; margin-left: 10px;" >50</p>
              <input type="text" id="inputValue3" onblur="checkEnter3(event)" style="width:80px;" placeholder="Enter Value" title="Enter a number between 0°and 180°">
          </div>

          <div style="display: flex; justify-content: center; align-items: center; padding-top: 10px;">
          <p style="color: black;">Shoulder:</p>
                <input type="range" style="width: 200px;" id="slider2" min="0" max="180" value="90" ontouchend="fetch(document.location.origin+'/control?var=car&val=3');" oninput="sendSliderValue22();" onmousedown="sendSliderValue22();" onchange="updateValue2(this.value);">
                
                <p id="sliderValue2" style="color: black; width: 25px; margin-left: 10px;">40</p>
                <input type="text" id="inputValue2" onblur="checkEnter2(event)" style="width:80px;" placeholder="Enter Value" title="Enter a number between 0°and 180°">
            </div>

          <div style="display: flex; justify-content: center; align-items: center; padding-top: 10px;">
          <p style="color: black;">Chassis :</p>
                <input type="range" style="width: 200px;" id="slider1" min="0" max="180" value="90" ontouchend="fetch(document.location.origin+'/control?var=car&val=3');" oninput="sendSliderValue11();" onmousedown="sendSliderValue11();" onchange="updateValue1(this.value);">
                
                <p id="sliderValue1" style="color: black; width: 25px; margin-left: 10px;">90</p>
                <input type="text" id="inputValue1" onblur="checkEnter1(event)" style="width:80px;" placeholder="Enter Value" title="Enter a number between 0°and 180°">
            </div> 


          <p style="color: black; display: flex; justify-content: center; align-items: center; font-size: 25px;">Custom mode</p>

          <div style="display: flex; justify-content: center; align-items: center; padding-top:8px;">    
            <select id="ModeSelect" onchange="handleModeChange(this.value);">
              <!-- <option value="0">MODE</option> -->
              <option value="1">MODE 1</option>
              <option value="2">MODE 2</option>
              <option value="3">MODE 3</option>
              <option value="4">MODE 4</option>
              <option value="5">MODE 5</option>
              <option value="6">MODE 6</option>
            </select> 
          </div>

          <div class="cont_flex1">    
            
            <button type="button" id="Start_End">Start</button>

            <button type="button" id="Save" onclick="ButtonNote1()">Save</button>

            <button type="button" id="Start" onclick="ButtonNote3()">Run</button>

            <button type="button" id="Reset" onclick="ButtonNote2()">Reset</button>  
          </div>

          <p style="color: black; display: flex; justify-content: center; align-items: center; padding-bottom: 5px; font-size: 25px;">Spatial coordinate</p>

          <div style="display: flex; justify-content: center; align-items: center; padding-bottom:5px;"> 
              
              <p style="color: black; margin-right: 3px;">X:</p>
              <input type="text" style="width: 75px; margin-right: 3px;" id="inputX" placeholder="Enter Value" title="Note the value range when entering the X value"> 

              <p style="color: black; margin-right: 3px;">Y:</p>
              <input type="text" style="width: 75px; margin-right: 3px;" id="inputY" placeholder="Enter Value" title="Note the value range when entering the Y value"> 

              <p style="color: black; margin-right: 3px;">Z:</p>
              <input type="text" style="width: 75px; margin-right: 6px;" id="inputZ" placeholder="Enter Value" title="Note the value range when entering the Z value"> 

              <button type="button" id="Commit" style="width:60px; height: 30px;" onclick="sendValueDw()" ontouchend="fetch(document.location.origin+'/control?var=car&val=3');">Commit</button>

          </div>

          <p style="color: red; display: flex; justify-content: center; align-items: center;  font-size: 15px;">The value of x ranges from -25 to 25.<br>The value of y ranges from 0 to 25.<br>The value of z ranges from 0 to 36.</p>

          <p style="color: red; display: flex; justify-content: center; align-items: center; padding-bottom: 5px; font-size: 15px;">Note: The value range is the point within the sphere.</p>

          <script>
              var customAlert = document.getElementById("customAlert");
              var alertText = document.getElementById("alertText");
              function hideAlert() {
                    customAlert.style.opacity = "0";
                    customAlert.style.visibility = "hidden";
                }

              

              function ButtonNote1(){
                  var startEndButton = document.getElementById("Start_End");
                  if (startEndButton.textContent === "Start") {
                      alertText.textContent = "No start record, please click the Start button.";
                
                  } else {
                      alertText.textContent = "Record success";
                      fetch(document.location.origin+'/control?var=car&val=31');
                      
                  }
                  customAlert.style.opacity = "1"; 
                  customAlert.style.visibility = "visible";
                  setTimeout(hideAlert, 1500);
              }

              function ButtonNote2(){
                  var startEndButton = document.getElementById("Start_End");
                  if (startEndButton.textContent === "End") {
                      alertText.textContent = "Now in record mode, please exit(End button) this mode and press Reset button again.";
                  } else {
                      alertText.textContent = "Reset success";
                      fetch(document.location.origin+'/control?var=car&val=35');
                      
                  }
                  customAlert.style.opacity = "1"; 
                  customAlert.style.visibility = "visible";
                  setTimeout(hideAlert, 1500);
              }

              function ButtonNote3(){
                  var startEndButton = document.getElementById("Start_End");
                  if (startEndButton.textContent === "End") {
                    alertText.textContent = "Now in record mode, please exit(End button) this mode and press Run button again.";
                  } else{
                    alertText.textContent = "Run";
                    fetch(document.location.origin+'/control?var=car&val=34');
                    
                  }
                  customAlert.style.opacity = "1"; 
                  customAlert.style.visibility = "visible";
                  setTimeout(hideAlert, 1500);

              }
              
              function sendValueDw(){
                var inputValue1 = document.getElementById("inputX").value;
                var inputValue2 = document.getElementById("inputY").value;
                var inputValue3 = document.getElementById("inputZ").value;
                
                if (isNaN(inputValue1) || inputValue1 == "") {
                    alertText.textContent = "Please enter a valid value for X.";
                    customAlert.style.opacity = "1"; 
                    customAlert.style.visibility = "visible";
                    setTimeout(hideAlert, 1500);
                    return; 
                }
                if (isNaN(inputValue2) || inputValue2 == "") {
                    alertText.textContent = "Please enter a valid value for Y.";
                    customAlert.style.opacity = "1"; 
                    customAlert.style.visibility = "visible";
                    setTimeout(hideAlert, 1500);
                    return; 
                }
                if (isNaN(inputValue3) || inputValue3 == "") {
                    alertText.textContent = "Please enter a valid value for Z.";
                    customAlert.style.opacity = "1"; 
                    customAlert.style.visibility = "visible";
                    setTimeout(hideAlert, 1500);
                    return; 
                }

                var xylen = 25;
                var zlen = 36
                
                if ( inputValue1 >xylen || inputValue1 < -xylen || inputValue2 > xylen || inputValue2 < 0 || inputValue3 >zlen || inputValue3 < 0) {
                    alertText.textContent = "Out of range!";
                    customAlert.style.opacity = "1"; 
                    customAlert.style.visibility = "visible";
                    setTimeout(hideAlert, 1500);
                    return; 
                }

                if ( inputValue1 == 0 && inputValue2 == 0 && inputValue3 < 28) {
                    alertText.textContent = "Out of range!";
                    customAlert.style.opacity = "1"; 
                    customAlert.style.visibility = "visible";
                    setTimeout(hideAlert, 1500);
                    return; 
                }
                
                var sphereCenter = [0, 0, 11];
                var radius = 25;
                var distance = Math.sqrt((inputValue1 - sphereCenter[0]) ** 2 + (inputValue2 - sphereCenter[1]) ** 2 + (inputValue3 - sphereCenter[2]) ** 2);
                if (distance > radius) {
                  alertText.textContent = "Out of range!";
                        customAlert.style.opacity = "1"; 
                        customAlert.style.visibility = "visible";
                        setTimeout(hideAlert, 1500);
                        return; 
                }

                
                var radius_min = 12;
                var distance_min = Math.sqrt((inputValue1 - sphereCenter[0]) ** 2 + (inputValue2 - sphereCenter[1]) ** 2 + (inputValue3 - sphereCenter[2]) ** 2);
                if (distance_min < radius_min) {
                  alertText.textContent = "Out of range!";
                        customAlert.style.opacity = "1"; 
                        customAlert.style.visibility = "visible";
                        setTimeout(hideAlert, 1500);
                        return; 
                }


                

                fetch(document.location.origin + '/control?var=car&val=54&s1=' + inputValue1 + '&s2=' + inputValue2 + '&s3=' + inputValue3);
                
                alertText.textContent = "x:" + inputValue1 + ", y:" + inputValue2 + ", z:" + inputValue3;
                
                setTimeout(function() {
                    fetch(document.location.origin+'/control?var=car&val=3');
                }, 1320);

                customAlert.style.opacity = "1"; 
                customAlert.style.visibility = "visible";
                setTimeout(hideAlert, 1500);
              }
            

              function handleModeChange(mode) {
                switch(mode) {
                    case '0':
                      fetch(document.location.origin+'/control?var=car&val=40')
                      break;
                    case '1':
                      fetch(document.location.origin+'/control?var=car&val=41')
                      alertText.textContent = "Mode 1";
                      customAlert.style.opacity = "1"; 
                      customAlert.style.visibility = "visible";
                      setTimeout(hideAlert, 1500);
                      break;
                    case '2':
                      fetch(document.location.origin+'/control?var=car&val=42')
                      alertText.textContent = "Mode 2";
                      customAlert.style.opacity = "1"; 
                      customAlert.style.visibility = "visible";
                      setTimeout(hideAlert, 1500);
                      break;
                    case '3':
                      fetch(document.location.origin+'/control?var=car&val=43')
                      alertText.textContent = "Mode 3";
                      customAlert.style.opacity = "1"; 
                      customAlert.style.visibility = "visible";
                      setTimeout(hideAlert, 1500);
                      break;
                    case '4':
                      fetch(document.location.origin+'/control?var=car&val=44')
                      alertText.textContent = "Mode 4";
                      customAlert.style.opacity = "1"; 
                      customAlert.style.visibility = "visible";
                      setTimeout(hideAlert, 1500);
                      break;
                    case '5':
                      fetch(document.location.origin+'/control?var=car&val=45')
                      alertText.textContent = "Mode 5";
                      customAlert.style.opacity = "1"; 
                      customAlert.style.visibility = "visible";
                      setTimeout(hideAlert, 1500);
                      break;
                    case '6':
                      fetch(document.location.origin+'/control?var=car&val=46')
                      alertText.textContent = "Mode 6";
                      customAlert.style.opacity = "1"; 
                      customAlert.style.visibility = "visible";
                      setTimeout(hideAlert, 1500);
                      break;
                    default:
                      break;
                }
            }

              function updateValue1(value) {
                  document.getElementById("sliderValue1").textContent = value;
              }
              function updateValue2(value) {
                  document.getElementById("sliderValue2").textContent = value;
              }
              function updateValue3(value) {
                  document.getElementById("sliderValue3").textContent = value;
              }
              function updateValue4(value) {
                  document.getElementById("sliderValue4").textContent = value;
              }
              function updateValue5(value) {
                  document.getElementById("sliderValue5").textContent = value;
              }

              function updateSlider1(value) {
                  var slider = document.getElementById("slider1");
                  slider.value = value;
                  updateValue1(value);
              }
              function checkEnter1(event) {
                  
                      var inputValue = document.getElementById("inputValue1").value;
                      var numericValue = parseInt(inputValue);
                      if (isNaN(numericValue)) {
                          alertText.textContent = "Please enter a number.";
                          customAlert.style.opacity = "1"; 
                          customAlert.style.visibility = "visible";
                          setTimeout(hideAlert, 1000);
                          return;
                      } else if (numericValue < 0 || numericValue >180){
                        alertText.textContent = "Please enter a number between 0°and 180°.";
                        customAlert.style.opacity = "1"; 
                        customAlert.style.visibility = "visible";
                        setTimeout(hideAlert, 1000);
                        return;
                      }
                      numericValue = Math.max(0, Math.min(numericValue, 180)); 
                      updateSlider1(numericValue);
                      sendSliderValue1();
                      setTimeout(function() {
                          fetch(document.location.origin+'/control?var=car&val=3');
                      }, 200);
                  
              }

              function updateSlider2(value) {
                  var slider = document.getElementById("slider2");
                  slider.value = value;
                  updateValue2(value);
              }
              function checkEnter2(event) {
                  
                      var inputValue = document.getElementById("inputValue2").value;
                      var numericValue = parseInt(inputValue);
                      if (isNaN(numericValue)) {
                          alertText.textContent = "Please enter a number.";
                          customAlert.style.opacity = "1"; 
                          customAlert.style.visibility = "visible";
                          setTimeout(hideAlert, 1000);
                          return;
                      } else if (numericValue < 0 || numericValue >180){
                        alertText.textContent = "Please enter a number between 0°and 180°.";
                        customAlert.style.opacity = "1"; 
                        customAlert.style.visibility = "visible";
                        setTimeout(hideAlert, 1000);
                        return;
                      }
                      numericValue = Math.max(0, Math.min(numericValue, 180)); 
                      updateSlider2(numericValue);
                      sendSliderValue2();
                      setTimeout(function() {
                          fetch(document.location.origin+'/control?var=car&val=3');
                      }, 200);
                  
              }

              function updateSlider3(value) {
                  var slider = document.getElementById("slider3");
                  slider.value = value;
                  updateValue3(value);
              }
              function checkEnter3(event) {
                  
                      var inputValue = document.getElementById("inputValue3").value;
                      var numericValue = parseInt(inputValue);
                      if (isNaN(numericValue)) {
                          alertText.textContent = "Please enter a number.";
                          customAlert.style.opacity = "1"; 
                          customAlert.style.visibility = "visible";
                          setTimeout(hideAlert, 1000);
                          return;
                      } else if (numericValue < 0 || numericValue >180){
                        alertText.textContent = "Please enter a number between 0°and 180°.";
                        customAlert.style.opacity = "1"; 
                        customAlert.style.visibility = "visible";
                        setTimeout(hideAlert, 1000);
                        return;
                      }
                      numericValue = Math.max(0, Math.min(numericValue, 180)); 
                      updateSlider3(numericValue);
                      sendSliderValue3();
                      setTimeout(function() {
                          fetch(document.location.origin+'/control?var=car&val=3');
                      }, 200);
              }

              function updateSlider4(value) {
                  var slider = document.getElementById("slider4");
                  slider.value = value;
                  updateValue4(value);
              }
              function checkEnter4(event) {
                  
                      var inputValue = document.getElementById("inputValue4").value;
                      var numericValue = parseInt(inputValue);
                      if (isNaN(numericValue)) {
                          alertText.textContent = "Please enter a number.";
                          customAlert.style.opacity = "1"; 
                          customAlert.style.visibility = "visible";
                          setTimeout(hideAlert, 1000);
                          return;
                      } else if (numericValue < 90 || numericValue >180){
                        alertText.textContent = "Please enter a number between 90°and 180°.";
                        customAlert.style.opacity = "1"; 
                        customAlert.style.visibility = "visible";
                        setTimeout(hideAlert, 1000);
                        return;
                      }
                      numericValue = Math.max(90, Math.min(numericValue, 180)); 
                      updateSlider4(numericValue);
                      sendSliderValue4();
                      setTimeout(function() {
                          fetch(document.location.origin+'/control?var=car&val=3');
                      }, 200);
                  
              }

              function updateSlider5(value) {
                  var slider = document.getElementById("slider5");
                  slider.value = value;
                  updateValue5(value);
              }
              function checkEnter5(event) {
                  
                      var inputValue = document.getElementById("inputValue5").value;
                      var numericValue = parseInt(inputValue);
                      if (isNaN(numericValue)) {
                          alertText.textContent = "Please enter a number.";
                          customAlert.style.opacity = "1"; 
                          customAlert.style.visibility = "visible";
                          setTimeout(hideAlert, 1000);
                          return;
                      } else if (numericValue < 0 || numericValue >180){
                        alertText.textContent = "Please enter a number between 0°and 180°.";
                        customAlert.style.opacity = "1"; 
                        customAlert.style.visibility = "visible";
                        setTimeout(hideAlert, 1000);
                        return;
                      }
                      numericValue = Math.max(0, Math.min(numericValue, 180)); 
                      updateSlider5(numericValue);
                      sendSliderValue5();
                      setTimeout(function() {
                          fetch(document.location.origin+'/control?var=car&val=3');
                      }, 200);
                  
              }

            var button = document.getElementById("Start_End");
            var buttonText = ["End", "Start"];
            var currentTextIndex = 0;
            button.addEventListener("click", function() {
              button.textContent = buttonText[currentTextIndex];
              if (button.textContent === "Start") {
                var startV = document.location.origin + "/control?var=car&val=33";
                fetch(startV);
                alertText.textContent = "End record";
              } else {
                var EndV = document.location.origin + "/control?var=car&val=32";
                fetch(EndV);
                alertText.textContent = "Start recording";

              }
              customAlert.style.opacity = "1"; 
              customAlert.style.visibility = "visible";
              currentTextIndex = (currentTextIndex + 1) % buttonText.length;
              setTimeout(hideAlert, 1500);
            });

            function sendSliderValue1() {
              var sliderValue1 = document.getElementById("slider1").value;
              var url = document.location.origin + "/control?var=car&val=21&s1=" + sliderValue1;
              fetch(url);
            }

            function sendSliderValue11() {
              var sliderValue1 = document.getElementById("slider1").value;
              var url = document.location.origin + "/control?var=car&val=25&s1=" + sliderValue1;
              fetch(url);
            }

            function sendSliderValue2() {
              var sliderValue2 = document.getElementById("slider2").value;
              var url = document.location.origin + "/control?var=car&val=22&s2=" + sliderValue2;
              fetch(url);
            }

            function sendSliderValue22() {
              var sliderValue2 = document.getElementById("slider2").value;
              var url = document.location.origin + "/control?var=car&val=26&s2=" + sliderValue2;
              fetch(url);
            }

            function sendSliderValue3() {
              var sliderValue3 = document.getElementById("slider3").value;
              var url = document.location.origin + "/control?var=car&val=23&s3=" + sliderValue3;
              fetch(url);
            }

            function sendSliderValue33() {
              var sliderValue3 = document.getElementById("slider3").value;
              var url = document.location.origin + "/control?var=car&val=27&s3=" + sliderValue3;
              fetch(url);
            }

            function sendSliderValue4() {
              var sliderValue4 = document.getElementById("slider4").value;
              var url = document.location.origin + "/control?var=car&val=24&s4=" + sliderValue4;
              fetch(url);
            }

            function sendSliderValue44() {
              var sliderValue4 = document.getElementById("slider4").value;
              var url = document.location.origin + "/control?var=car&val=28&s4=" + sliderValue4;
              fetch(url);
            }

            function sendSliderValue5() {
              var sliderValue5 = document.getElementById("slider5").value;
              var url = document.location.origin + "/control?var=car&val=29&s5=" + sliderValue5;
              fetch(url);
            }

            function sendSliderValue55() {
              var sliderValue5 = document.getElementById("slider5").value;
              var url = document.location.origin + "/control?var=car&val=30&s5=" + sliderValue5;
              fetch(url);
            }


              window.onload = function(){
                  var canvas = document.getElementById("canvas");
                  var ctx = canvas.getContext("2d");

                  ctx.fillStyle = "rgb(255,0,0)";
                  ctx.fillRect(73,25,60,35);
                  ctx.clearRect(78,30,50,25);

                  ctx.fillRect(93,20,20,5);
                  ctx.fillRect(68,35,5,15);
                  ctx.fillRect(133,35,5,15);

                  ctx.beginPath();
                  ctx.arc(92,42,6,0,2*Math.PI,true);
                  ctx.fill();

                  ctx.beginPath();
                  ctx.arc(117,42,6,0,2*Math.PI,true);
                  ctx.fill();

                  ctx.beginPath();
                  ctx.arc(104,100,35,0,Math.PI,true);
                  ctx.fill();

                  ctx.clearRect(50,85,100,20);

              }
          
              document.addEventListener(
              'DOMContentLoaded',function(){
                  function b(B){let C;switch(B.type){case'checkbox':C=B.checked?1:0;break;case'range':case'select-one':C=B.value;break;case'button':case'submit':C='1';break;default:return;}const D=`${c}/control?var=${B.id}&val=${C}`;fetch(D).then(E=>{console.log(`request to ${D} finished, status: ${E.status}`)})}var c=document.location.origin;const e=B=>{B.classList.add('hidden')},f=B=>{B.classList.remove('hidden')},g=B=>{B.classList.add('disabled'),B.disabled=!0},h=B=>{B.classList.remove('disabled'),B.disabled=!1},i=(B,C,D)=>{D=!(null!=D)||D;let E;'checkbox'===B.type?(E=B.checked,C=!!C,B.checked=C):(E=B.value,B.value=C),D&&E!==C?b(B):!D&&('aec'===B.id?C?e(v):f(v):'agc'===B.id?C?(f(t),e(s)):(e(t),f(s)):'awb_gain'===B.id?C?f(x):e(x):'face_recognize'===B.id&&(C?h(n):g(n)))};document.querySelectorAll('.close').forEach(B=>{B.onclick=()=>{e(B.parentNode)}}),fetch(`${c}/status`).then(function(B){return B.json()}).then(function(B){document.querySelectorAll('.default-action').forEach(C=>{i(C,B[C.id],!1)})});const j=document.getElementById('stream'),k=document.getElementById('stream-container'),l=document.getElementById('get-still'),m=document.getElementById('toggle-stream'),n=document.getElementById('face_enroll'),o=document.getElementById('close-stream'),p=()=>{window.stop(),m.innerHTML='Start Stream'},q=()=>{j.src=`${c+':81'}/stream`,f(k),m.innerHTML='Stop Stream'};l.onclick=()=>{p(),j.src=`${c}/capture?_cb=${Date.now()}`,f(k)},o.onclick=()=>{p(),e(k)},m.onclick=()=>{const B='Stop Stream'===m.innerHTML;B?p():q()},n.onclick=()=>{b(n)},document.querySelectorAll('.default-action').forEach(B=>{B.onchange=()=>b(B)});const r=document.getElementById('agc'),s=document.getElementById('agc_gain-group'),t=document.getElementById('gainceiling-group');r.onchange=()=>{b(r),r.checked?(f(t),e(s)):(e(t),f(s))};const u=document.getElementById('aec'),v=document.getElementById('aec_value-group');u.onchange=()=>{b(u),u.checked?e(v):f(v)};const w=document.getElementById('awb_gain'),x=document.getElementById('wb_mode-group');w.onchange=()=>{b(w),w.checked?f(x):e(x)};const y=document.getElementById('face_detect'),z=document.getElementById('face_recognize'),A=document.getElementById('framesize');A.onchange=()=>{b(A),5<A.value&&(i(y,!1),i(z,!1))},y.onchange=()=>{return 5<A.value?(alert('Please select CIF or lower resolution before enabling this feature!'),void i(y,!1)):void(b(y),!y.checked&&(g(n),i(z,!1)))},z.onchange=()=>{return 5<A.value?(alert('Please select CIF or lower resolution before enabling this feature!'),void i(z,!1)):void(b(z),z.checked?(h(n),i(y,!0)):g(n))}});
          
          </script>
      </body>
</html>
)rawliteral";

static esp_err_t index_handler(httpd_req_t *req){
    httpd_resp_set_type(req, "text/html");
    return httpd_resp_send(req, (const char *)INDEX_HTML, strlen(INDEX_HTML));
}

void ACB_CAR_ARM::startWebServer() {
    server = new WiFiServer(100);
    server->begin();
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    
    httpd_uri_t index_uri = {
        .uri       = "/",
        .method    = HTTP_GET,
        .handler   = index_handler,
        .user_ctx  = NULL
    };

    httpd_uri_t cmd_uri = {
        .uri       = "/control",
        .method    = HTTP_GET,
        .handler   = cmd_handler,
        .user_ctx  = NULL
    };
    
    Serial.printf("Starting web server on port: '%d'\n", config.server_port);
    if (httpd_start(&camera_httpd, &config) == ESP_OK) {
        httpd_register_uri_handler(camera_httpd, &index_uri);
        httpd_register_uri_handler(camera_httpd, &cmd_uri);
    }
}

void ACB_CAR_ARM::startAppServer() {
    server = new WiFiServer(100);
    server->begin();

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    
    httpd_uri_t index_uri = {
        .uri       = "/",
        .method    = HTTP_GET,
        .handler   = index_handler,
        .user_ctx  = NULL
    };

    httpd_uri_t cmd_uri = {
        .uri       = "/control",
        .method    = HTTP_GET,
        .handler   = cmd_handler,
        .user_ctx  = NULL
    };
    
    
    Serial.printf("Starting web server on port: '%d'\n", config.server_port);
    if (httpd_start(&camera_httpd, &config) == ESP_OK) {
        // httpd_register_uri_handler(camera_httpd, &index_uri);
        httpd_register_uri_handler(camera_httpd, &cmd_uri);
    }
}