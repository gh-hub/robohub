#include "ACB_CAR_ACTION.h"

String sendBuff;
byte dataLen, index_a = 0;
char buffer[52];
unsigned char prevc = 0;
bool isStart = false;
bool ED_client = true;
bool WA_en = false;
byte RX_package[17] = {0};
uint16_t angle = 90;
byte val = 0;
char model_var = 0;
int UT_distance = 0;

unsigned char readBuffer(int index_r)
{
    return buffer[index_r];
}
void writeBuffer(int index_w, unsigned char c)
{
    buffer[index_w] = c;
}

ACB_CAR_ACTION::ACB_CAR_ACTION()
{
}

void ACB_CAR_ACTION::init()
{
    server = new WiFiServer(100);
    server->begin();
}

void ACB_CAR_ACTION::actionCallback(CallbackFunction callback)
{
    callbackFunction = callback;
}

void ACB_CAR_ACTION::parseData()
{
    isStart = false;
    int action = readBuffer(9);
    int device = readBuffer(10);
    int val = readBuffer(12);

    if (action == 1 && device == 12)
    {
        switch (val)
        {
        case 0:
            callbackFunction("stop", 0);
            break;
        case 1:
            callbackFunction("forward", 0);
            break;
        case 2:
            callbackFunction("backward", 0);
            break;
        case 3:
            callbackFunction("left", 0);
            break;
        case 4:
            callbackFunction("right", 0);
            break;
        case 9:
            callbackFunction("anticlockwise", 0);
            break;
        case 10:
            callbackFunction("clockwise", 0);
            break;
        }
    }

    if (action == 1 && device == 13)
    {
        callbackFunction("speed", val);
    }

    if (action == 1 && device == 2)
    {
        callbackFunction("servo", val);
    }

    if (action == 1 && device == 5)
    {
        callbackFunction("led", val);
    }

    if (action == 1 && device == 3)
    {
        callbackFunction("buzzer", val);
    }

    if (action == 4)
    {
        callbackFunction("track", 0);
    }

    if (action == 5)
    {
        callbackFunction("track", 1);
    }

    if (action == 6)
    {
        callbackFunction("avoidance", 0);
    }

    if (action == 7)
    {
        callbackFunction("follow", 0);
    }

    if (action == 3)
    {
        callbackFunction("stop", 1);
    }

    if (action == 1 && device == 8)
    {
        callbackFunction("shooting", 0);
    }
}

void ACB_CAR_ACTION::loop()
{
    client = server->available();
    if (client)
    {
        WA_en = true;
        ED_client = true;
        while (client.connected())
        {
            if (client.available())
            {
                unsigned char c = client.read() & 0xff;
                // Serial.write(c);
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
    }
    else
    {
        if (ED_client == true)
        {
            ED_client = false;
        }
    }
}
