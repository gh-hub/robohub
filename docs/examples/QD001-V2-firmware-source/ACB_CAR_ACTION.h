#ifndef ACB_CAR_ACTION_H
#define ACB_CAR_ACTION_H

#include <Arduino.h>
#include <WiFi.h>

class ACB_CAR_ACTION
{
public:
	ACB_CAR_ACTION();
	//积木名:初始化
	void init();

	void parseData();

	//积木名:初始化
	void loop();

	typedef void (*CallbackFunction)(String,int);
	
	//积木名:回调 有两个参数 命令名 和 值
	void actionCallback(CallbackFunction callback);

private:
	WiFiServer *server;
	WiFiClient client;
	CallbackFunction callbackFunction;
};

#endif