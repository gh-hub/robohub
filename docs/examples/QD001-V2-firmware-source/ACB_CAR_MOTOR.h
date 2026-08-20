#ifndef ACB_CAR_MOTOR_H
#define ACB_CAR_MOTOR_H

#include <Arduino.h>

class ACB_CAR_MOTOR
{
public:
	ACB_CAR_MOTOR();

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
	void speed(int value);

private:
	int _speed = 0;
};

#endif