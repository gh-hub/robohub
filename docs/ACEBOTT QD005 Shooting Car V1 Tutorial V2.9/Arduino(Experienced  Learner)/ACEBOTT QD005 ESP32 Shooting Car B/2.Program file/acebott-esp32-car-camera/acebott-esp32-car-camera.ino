#include <WiFi.h>
#include "esp_camera.h"
#include <WebServer.h>
#include "html.h"
#include <vector>

WiFiServer server(100);  // Create a server object with port 100
WebServer webServer(81);

byte Stop[17] = { 0xff, 0x55, 0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x00, 0xf0, 0x00, 0x00, 0x00, 0x00 };  // Stop command buffer
String sendBuff;                                                                                                           // Buffer used to store data received from the serial port
String Version = "1.0.1";
bool ED_client = true;                                                                                                     // Track whether there is a flag for client connection
bool WA_en = false;                                                                                                        // Flag to enable client-side data processing

#define gpLED 4  // LED GPIO pins
#define RXD2 14  // GPIO pin of RXD2 (Serial2 input)
#define TXD2 13  // GPIO pin of TXD2 (Serial2 output)
void CameraWebServer_init();

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);
  CameraWebServer_init();  // Initialize camera web server
  server.begin();          // Start the server
  delay(100);

  pinMode(gpLED, OUTPUT);  // Set gpLED pin as output
  for (int i = 0; i < 5; i++) {
    digitalWrite(gpLED, HIGH);  // Turn on LED
    delay(20);
    digitalWrite(gpLED, LOW);  // Turn off LED
    delay(50);
  }

  webServer.on("/", []() {
    webServer.send(200, "text/html", html);
  });

  webServer.on("/control", []() {
    String cmd = webServer.arg("cmd");
    Serial.println(cmd);
    std::vector<uint8_t> data;
    if (cmd == "car") {
      String direction = webServer.arg("direction");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0C, 0x00 };
      if (direction == "Forward") {
        data.push_back(0x01);
      }
      if (direction == "Backward") {
        data.push_back(0x02);
      }
      if (direction == "Left") {
        data.push_back(0x03);
      }
      if (direction == "Right") {
        data.push_back(0x04);
      }
      if (direction == "Anticlockwise") {
        data.push_back(0x09);
      }
      if (direction == "Clockwise") {
        data.push_back(0x0A);
      }
      if (direction == "stop") {
        data.push_back(0x00);
      }
      if (direction == "LeftUp") {
        data.push_back(0x05);
      }
      if (direction == "RightUp") {
        data.push_back(0x07);
      }
      if (direction == "LeftDown") {
        data.push_back(0x06);
      }
      if (direction == "RightDown") {
        data.push_back(0x08);
      }
    }

    if (cmd == "speed") {
      String value = webServer.arg("value");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0D, 0x00 };
      if (value == "1") { data.push_back(0x82); }
      if (value == "2") { data.push_back(0xA0); }
      if (value == "3") { data.push_back(0xBE); }
      if (value == "4") { data.push_back(0xDC); }
      if (value == "5") { data.push_back(0xFF); }
    }

    if (cmd == "servo") {
      String angle = webServer.arg("angle");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, angle.toInt() };
    }

    if (cmd == "LED") {
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05, 0x00, 0x01 };  //Turn on LED
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05, 0x00, 0x00 };  //Turn off LED
    }

    if (cmd == "Buzzer") {
      String value = webServer.arg("value");
      data = { 0xFF, 0x55, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x03, 0x00 };
      if (value == "1") {
        data.push_back(0x01);  //1
      }
      if (value == "2") {
        data.push_back(0x02);  //2
      }
      if (value == "3") {
        data.push_back(0x03);  //3
      }
      if (value == "4") {
        data.push_back(0x04);  //4
      }
    }

    if (cmd == "Track") {
      String value = webServer.arg("value");
      if (value == "1") {
        data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04 };  //Mode 1
      }
      if (value == "2") {
        data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05 };  //Mode 2
      }
    }

    if (cmd == "Avoidance") {
      data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06 };
    }

    if (cmd == "Follow") {
      data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07 };
    }

    if (cmd == "Shooting") {
      data = { 0xFF, 0x55, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x08 };
    }

    if (cmd == "stopA") {
      data = { 0xFF, 0x55, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03 };
    }


    uint8_t *buffer = &data[0];
    Serial2.write(buffer, data.size());
    webServer.send(200, "text/plain", "ok");
  });
  webServer.begin();
}

void loop() {
  WiFiClient client = server.available();  // Check if any client is connected to the server
  if (client) {
    WA_en = true;      // Enable client data processing
    ED_client = true;  // Set client connection flag

    while (client.connected()) {
      if (client.available()) {
        unsigned char clientBuff = client.read() & 0xff;  // Read data from client
        Serial2.write(clientBuff);                        // Send data to Serial2
        Serial.write(clientBuff);                         // Print data to serial monitor
      }
      if (Serial.available()) {
        char c = Serial.read();   // Read data from serial monitor
        sendBuff += c;            // Add data to send buffer
        Serial2.print(sendBuff);  // Send data to Serial2
        sendBuff = "";            // clear send buffer
      }
      static unsigned long Test_time = 0;
      if (millis() - Test_time > 1000) {
        Test_time = millis();
        if (0 == (WiFi.softAPgetStationNum()))  // Check if the soft AP has no connected sites
        {
          Serial2.write(Stop, 17);  // Send stop command to Serial2
          break;                    // exit while loop
        }
      }
    }
    Serial2.write(Stop, 17);  // Send stop command to Serial2
    client.stop();            // Disconnect client
  } else {
    if (ED_client == true) {
      ED_client = false;
      Serial2.write(Stop, 17);  // Send stop command to Serial2
    }
  }
  webServer.handleClient();
}
