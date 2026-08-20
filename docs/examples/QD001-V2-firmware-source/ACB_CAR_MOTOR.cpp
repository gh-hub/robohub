#include "ACB_CAR_MOTOR.h"
#include "vehicle.h"

vehicle Acebott;

ACB_CAR_MOTOR::ACB_CAR_MOTOR()
{
    Acebott.Init();
    Acebott.Move(Stop, 0);
}

void ACB_CAR_MOTOR::forward(int value)
{
    _speed = value;
    Acebott.Move(Forward, _speed);
}
void ACB_CAR_MOTOR::backward(int value)
{
    _speed = value;
    Acebott.Move(Backward, _speed);
}
void ACB_CAR_MOTOR::left(int value)
{
    _speed = value;
    Acebott.Move(Move_Left, _speed);
}
void ACB_CAR_MOTOR::right(int value)
{
    _speed = value;
    Acebott.Move(Move_Right, _speed);
}
void ACB_CAR_MOTOR::anticlockwise(int value)
{
    _speed = value;
    Acebott.Move(Contrarotate, _speed);
}
void ACB_CAR_MOTOR::clockwise(int value)
{
    _speed = value;
    Acebott.Move(Clockwise, _speed);
}
void ACB_CAR_MOTOR::leftUp(int value)
{
    _speed = value;
    Acebott.Move(Top_Left, _speed);
}
void ACB_CAR_MOTOR::rightUp(int value)
{
    _speed = value;
    Acebott.Move(Top_Right, _speed);
}
void ACB_CAR_MOTOR::leftDown(int value)
{
    _speed = value;
    Acebott.Move(Bottom_Left, _speed);
}
void ACB_CAR_MOTOR::rightDown(int value)
{
    _speed = value;
    Acebott.Move(Bottom_Right, _speed);
}
void ACB_CAR_MOTOR::stop()
{
    Acebott.Move(Stop, 0);
}
void ACB_CAR_MOTOR::speed(int value)
{
    _speed = value;
}
