#ifndef ACB_CAR_ARM_H
#define ACB_CAR_ARM_H

#include <Arduino.h>
#include <WiFi.h>
#include <SoftwareSerial.h>  // 包含ESP32软件串口库
#define FIRMWARE_VERSION "图形化 机械臂小车 V1.0 20240820"

#define PWM1_PIN            19
#define PWM2_PIN            23
#define SHCP_PIN            18                          
#define EN_PIN              16                            
#define DATA_PIN            5                           
#define STCP_PIN            17                            

const int Forward           = 163;           // forward
const int Backward          = 92;            // back
const int Move_Left         = 106;           // left translation
const int Move_Right        = 149;           // Right translation 
const int Top_Left          = 34;            // Upper left mobile
const int Bottom_Left       = 72;            // Lower left mobile
const int Top_Right         = 129;           // Upper right mobile
const int Bottom_Right      = 20;            // The lower right move
const int Stop              = 0;             // stop
const int Contrarotate      = 83;            // Counterclockwise rotation
const int Clockwise         = 172;           // Rotate clockwise
const int Moedl1            = 25;            // model1
const int Moedl2            = 26;            // model2
const int Moedl3            = 27;            // model3
const int Moedl4            = 28;            // model4
const int MotorLeft         = 230;           // servo turn left
const int MotorRight        = 231;           // servo turn right
const int M1_Forward        = 128;
const int M1_Backward       = 64;
const int M2_Forward        = 32;
const int M2_Backward       = 16;
const int M3_Forward        = 2;
const int M3_Backward       = 4;
const int M4_Forward        = 1;
const int M4_Backward       = 8;

struct ServoState {
  int pos1;
  int pos2;
  int pos3;
  int pos4;
  int pos5;
};


class ACB_CAR_ARM 
{
public:
  ACB_CAR_ARM();
  
  static uint8_t g_screen_pattern;
  static uint8_t g_screen_data[16];
  static int8_t  g_mp3_cmd;
  static uint8_t g_mp3_volume;

  static int val;
  static int Chassis_Silde_Angle;
  static int Shoulder_Silde_Angle;
  static int Elbow_Silde_Angle;
  static int Wrist_Silde_Angle;
  static int Claws_Silde_Angle;
  
  static int RGB_Red_Val;
  static int RGB_Blue_Val;
  static int RGB_Green_Val;
  
  static int PTP_X;
  static int PTP_Y;
  static int PTP_Z;

  static int Speeds;
  
  static int mode;
  static int stateCount1;
  static int stateCount2;
  static int stateCount3;
  static int stateCount4;
  static int stateCount5;
  static int stateCount6;

  void ARM_init(int servo1, int servo2, int servo3, int servo4, int servo5);

  void limitZ(float pos__2, float pos__3);
  
  void ClawsCmd(int poss);
  void ElbowCmd(int poss);
  void ShoulderCmd(int poss);
  void ChassisCmd(int poss);
  void WristCmd(int poss);

  void Speed(int speeds);

  void PtpCmd (float x, float y, float z);

  void Zero();
  void Chassis_angle_adjust(float chassis_pos,float right_pos,float left_pos);
  void Slight_adjust(float right_pos,float left_pos);

  void saveState();
  void executeStates();
  void clearSavedStates();

  int getPositon(char value);

  void Ultrasonic_init(); 
  float Ultrasonic_Ranging(int Trig, int Echo);

  void Vehicle_init();          //V1驱动版
  void Vehicle_Move(int Dir, int Speed);

  void Car_init(char version);

  void startWebServer();
  void startAppServer();

  void Silde_ChassisCmd(float chassis_angles);
  void Silde_ShoulderCmd(float shoulder_angles);
  void Silde_ElbowCmd(float elbow_angles);
  void Silde_WristCmd(float wrist_angles);
  void Silde_ClawsCmd(float claws_angles);

  void Vehicle_init_V2();                      //V2驱动版
  void motorControl(uint8_t motor, int speed); //单电机

  void Follow();
  void Avoid();
  void Track();
  void Track0();
  void Track_init();
  void Carloop();
  void CarMove();

  void parseData();
  void init();

  void forward(int value);
	void backward(int value);
	void left(int value);
	void right(int value);
	void anticlockwise(int value);
	void clockwise(int value);
	void leftUp(int value);
	void rightUp(int value);
	void leftDown(int value);
	void rightDown(int value);
	void stop();
	void CARspeed(int value);

  void Esp32CarLoop();
  void Shoot_init(int Shoot_PIN);
  void Shoot();
  void Shoot_open();
  void Shoot_close();
  void Camera_servo(int TURN_SERVO_PIN);
  void Servo_move(int Camera_servo_angle);

  /*************************** new 2025-5-24 ************************************ */
  void sendCommand(const char* cmd);

  void lcd_init(); // 屏幕初始化
  void lcd_rotation(int dir); // 屏幕旋转方向(0 1 2 3)
  void lcd_ROI(int x, int y, int w, int h); //画面裁切
  void lcd_zoom(float zoom_factor = 4);  //屏幕缩放
  void lcd_flip(int state = 0);  //屏幕镜像
  void lcd_move(int x, int y);

  void camera_init(); // 摄像头初始化
  void camera_framsize(String framsize); // 摄像头分辨率（QVGA/QQVGA）
  void camera_state(String state);  // 摄像头（开启/关闭）
  void camera_display(); // 摄像头在LCD显示画面（删除）
  void barcode_recognize(); // 条形码识别
  void qrcode_recognize(); // 二维码识别
  void kpu_init(String kpu_address); // kpu初始化
  void number_recognize(); // 数字识别
  void received_data(); // 获取x y w h tag
  void kpu_deinit();    // 释放kpu
  
  void color_recognize();  //颜色识别
  void color_appoint_recognize(String color);//颜色识别跟踪
  void face_recognize();   //人脸巡线
  void tacking_open();     //视觉巡线
  String Visual_data();    //获取视觉巡线返回值
  void Traffic_identification(); //巡线路标任务

  // 图形化调用任务
  void machine_learning(); //机器学习任务
  void photo_program();    //拍照任务  
  
  void image_recognize();   //图像识别
  void tacking_graphical(); //视觉巡线-返回权重
  void face_graphical();    //人脸识别
  void Traffic_graphical(); //交通牌识别

  void GRB_red(char red);
  void GRB_green(char green);
  void GRB_blue(char blue);
  
  void Exit_task();          
  
  int getX() const { return x; }
  int getY() const { return y; }
  int getW() const { return w; }
  int getH() const { return h; }
  String getTag() const { return tag; }

  int Shoot_PINS;
  int Car_Speed = 150;
  int chassis_angle = 90, shoulder_angle = 40, elbow_angle = 50, claws_angle = 90, wrist_angle = 90;  // define the variable of 4 servo angle,and assign the initial value (that is the boot posture
  //angle value)
  int middleDistance = 0;
  const int PWMRES_Min = 0; // PWM Resolution 0
  const int PWMRES_Max = 180; // PWM Resolution 180
  const int SERVOMIN = 400; // 400
  const int SERVOMAX = 2400; // 2400
  unsigned long lastMovementTime = 0;
  const unsigned long printDelay = 3000; // 3 seconds

  // Define arm length (in inches) and base position
  const float arm1_length = 11;  // Length of arm 1
  const float arm2_length = 7.5;  // Lexngth of arm 2 
  const float arm3_length = 17.5;  // Length of arm 3

  float limit_z;
  float servo_angle1,servo_angle2,servo_angle3,servo_angle4;

  int number = 10;//Record the number of actions

  int maxStates = 20;              // 去除 const 修饰
  int stateCount = 0;
  // int stateCount1 = 0;
  // int stateCount2 = 0;
  // int stateCount3 = 0;
  // int stateCount4 = 0;
  // int stateCount5 = 0;
  // int stateCount6 = 0;
  int currentState1 = 0;
  int currentState2 = 0;
  int currentState3 = 0;
  int currentState4 = 0;
  int currentState5 = 0;
  int currentState6 = 0;
  int currentState = 0;
  
  ServoState states[20];
  ServoState states1[20];
  ServoState states2[20];
  ServoState states3[20];
  ServoState states4[20];
  ServoState states5[20];
  ServoState states6[20];

  float chassis_pos = 0;
  float right_poss;
  float left_poss;

  int speed = 20;

  // int mode = 1;

  int WuchaPos = 0;

  int chassis_pos2 = 0;
  int UT_distance = 0;

  int Left_Tra_Value;
  int Middle_Tra_Value;
  int Right_Tra_Value;
  int Left_sensor = 35;
  int Middle_sensor = 36;
  int Right_sensor = 39;
  int Black_Line = 2000;
  int Off_Road = 4000;
  
  int SliderAngle = 90;
  int Camera_servo_angles = 90;

  bool st = false;

private:
  WiFiServer *server;
	WiFiClient client;
  int _speed = 150;

  int x = 0;
  int y = 0;
  int w = 0;
  int h = 0;
  String tag="";

  SoftwareSerial* v2Serial = nullptr;

  // V2版本速度映射函数
  uint8_t mapSpeed(int input);
  
};

#endif // ACB_CAR_ARM_H