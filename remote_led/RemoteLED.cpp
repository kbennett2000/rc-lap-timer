#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP8266WebServer.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// Network credentials
const char* ssid = "rc-lap-timer";
const char* password = "rclaptimer";

// Pin definitions for both LEDs
// LED 1
const int RED_PIN_1 = 16;    // D0
const int GREEN_PIN_1 = 5;   // D1
const int BLUE_PIN_1 = 4;    // D2

// LED 2
const int RED_PIN_2 = 0;     // D3
const int GREEN_PIN_2 = 2;   // D4
const int BLUE_PIN_2 = 15;   // D8

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
ESP8266WebServer server(80);

// Current LED states
int currentRed = 0;
int currentGreen = 0;
int currentBlue = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\nStarting setup...");
  
  server.enableCORS(true);

  // Initialize I2C with correct pins
  Wire.begin(12, 14);  // SDA = D6 (GPIO12), SCL = D5 (GPIO14)
  
  // Initialize OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("SSD1306 allocation failed!");
    while(1) {
      delay(1000);
      Serial.println("OLED failed to start!");
    }
  }
  
  // Initialize LED pins
  pinMode(RED_PIN_1, OUTPUT);
  pinMode(GREEN_PIN_1, OUTPUT);
  pinMode(BLUE_PIN_1, OUTPUT);
  pinMode(RED_PIN_2, OUTPUT);
  pinMode(GREEN_PIN_2, OUTPUT);
  pinMode(BLUE_PIN_2, OUTPUT);
  
  // Test both LEDs
  testLEDs();
  
  // Initialize WiFi connection with retry
  setupWiFi();
  
  server.on("/", handleRoot);
  server.on("/rgb", handleRGBGet);
  server.on("/pattern", handlePatternGet);
  server.on("/text", handleTextGet);
  
  server.begin();
}

void loop() {
  server.handleClient();

  // Check WiFi connection and try to reconnect if lost
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost!");
    setupWiFi();  // Try to reconnect
  }
}

// Function to test both LEDs on startup
void testLEDs() {
  // Test LED 1
  digitalWrite(RED_PIN_1, HIGH);
  digitalWrite(RED_PIN_2, HIGH);
  delay(500);
  digitalWrite(RED_PIN_1, LOW);
  digitalWrite(RED_PIN_2, LOW);
  
  digitalWrite(GREEN_PIN_1, HIGH);
  digitalWrite(GREEN_PIN_2, HIGH);
  delay(500);
  digitalWrite(GREEN_PIN_1, LOW);
  digitalWrite(GREEN_PIN_2, LOW);
  
  digitalWrite(BLUE_PIN_1, HIGH);
  digitalWrite(BLUE_PIN_2, HIGH);
  delay(500);
  digitalWrite(BLUE_PIN_1, LOW);
  digitalWrite(BLUE_PIN_2, LOW);
}

void setLEDColors(int red, int green, int blue) {
  // Set colors for LED 1
  analogWrite(RED_PIN_1, red);
  analogWrite(GREEN_PIN_1, green);
  analogWrite(BLUE_PIN_1, blue);
  
  // Set same colors for LED 2
  analogWrite(RED_PIN_2, red);
  analogWrite(GREEN_PIN_2, green);
  analogWrite(BLUE_PIN_2, blue);
}

void handleRoot() {
  String html = "<html><body>";
  html += "<h1>RGB LED Control</h1>";
  html += "<p>Current RGB: " + String(currentRed) + ", " + String(currentGreen) + ", " + String(currentBlue) + "</p>";
  html += "<h2>Examples:</h2>";
  html += "<ul>";
  html += "<li><a href='/rgb?r=255&g=0&b=0'>Red</a></li>";
  html += "<li><a href='/rgb?r=0&g=255&b=0'>Green</a></li>";
  html += "<li><a href='/rgb?r=0&g=0&b=255'>Blue</a></li>";
  html += "<li><a href='/rgb?r=255&g=255&b=0'>Yellow</a></li>";
  html += "<li><a href='/pattern?name=police'>Police</a></li>";
  html += "<li><a href='/pattern?name=rainbow'>Rainbow</a></li>";
  html += "<li><a href='/pattern?name=strobe'>Strobe</a></li>";
  html += "<li><a href='/text?title=Alert&message=System Status OK'>Display Text</a></li>";
  html += "</ul>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleRGBGet() {
  if (server.hasArg("r") && server.hasArg("g") && server.hasArg("b")) {
    currentRed = server.arg("r").toInt();
    currentGreen = server.arg("g").toInt();
    currentBlue = server.arg("b").toInt();
    
    setLEDColors(currentRed, currentGreen, currentBlue);
    
    // Update OLED
    //display.clearDisplay();
    //display.setCursor(0,0);
    //display.setTextSize(2);
    //display.println("RGB LED");
    //display.setTextSize(1);
    //display.println("");
    //display.print("R: "); display.println(currentRed);
    //display.print("G: "); display.println(currentGreen);
    //display.print("B: "); display.println(currentBlue);
    //display.display();
    
    server.sendHeader("Location", "/");
    server.send(303);
  } else {
    server.send(400, "text/plain", "Missing RGB values");
  }
}

void handlePatternGet() {
  if (server.hasArg("name")) {
    String pattern = server.arg("name");
    
    // Update OLED with current pattern
    //display.clearDisplay();
    //display.setCursor(0,0);
    //display.setTextSize(2);
    //display.println("Pattern");
    //display.setTextSize(1);
    //display.println("");
    //display.println(pattern);
    //display.display();
    
    if (pattern == "police") {
      displayPolice();
    } else if (pattern == "rainbow") {
      displayRainbow();
    } else if (pattern == "strobe") {
      displayStrobe();
    } else {
      server.send(400, "text/plain", "Unknown pattern");
      return;
    }
    
    server.sendHeader("Location", "/");
    server.send(303);
  } else {
    server.send(400, "text/plain", "No pattern specified");
  }
}

void handleTextGet() {
  String title = server.hasArg("title") ? server.arg("title") : "Message";
  String message = server.hasArg("message") ? server.arg("message") : "";
  
  // Update OLED
  display.clearDisplay();
  display.setCursor(0,0);
  
  // Display title in larger text
  display.setTextSize(2);
  display.println(title);
  
  // Line separator
  display.setTextSize(1);
  display.println("");
  
  // Word wrap for message
  int16_t x1, y1;
  uint16_t w, h;
  String currentLine = "";
  String words = message;
  
  while (words.length() > 0) {
    int spaceIndex = words.indexOf(' ');
    String word = (spaceIndex == -1) ? words : words.substring(0, spaceIndex);
    
    display.getTextBounds((currentLine + " " + word).c_str(), 0, 0, &x1, &y1, &w, &h);
    
    if (w > SCREEN_WIDTH) {
      display.println(currentLine);
      currentLine = word;
    } else {
      if (currentLine.length() > 0) {
        currentLine += " ";
      }
      currentLine += word;
    }
    
    if (spaceIndex == -1) {
      words = "";
    } else {
      words = words.substring(spaceIndex + 1);
    }
  }
  
  if (currentLine.length() > 0) {
    display.println(currentLine);
  }
  
  display.display();
  
  server.sendHeader("Location", "/");
  server.send(303);
}

void setupWiFi() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  WiFi.mode(WIFI_STA);  // Set as station, not access point
  
  while (WiFi.status() != WL_CONNECTED) {
    display.clearDisplay();
    display.setCursor(0,0);
    display.setTextSize(2);
    display.println("Connecting");
    display.display();
    
    IPAddress staticIP(192, 168, 4, 99);   // Choose a fixed IP
    IPAddress gateway(192, 168, 4, 1);      // Pi's IP
    IPAddress subnet(255, 255, 255, 0);     // Standard subnet mask

    WiFi.config(staticIP, gateway, subnet);

    WiFi.begin(ssid, password);
    
    // Wait up to 10 seconds for connection
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      setLEDColors(0, 0, 25);

      display.clearDisplay();
      display.setCursor(0,0);
      display.setTextSize(2);
      display.println("  RC  Lap    Timer");
      display.setTextSize(1);
      display.println("");
      display.println("Connected with IP:");
      display.println(WiFi.localIP().toString());
      display.display();
      Serial.println("\nConnected to WiFi");
      Serial.println("IP: " + WiFi.localIP().toString());
    } else {
      display.clearDisplay();
      display.setCursor(0,0);
      display.setTextSize(2);
      display.println("Connection failed");
      display.setTextSize(1);
      display.println("Retrying in 5s...");
      display.display();
      Serial.println("\nConnection failed, retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void displayPolice() {
  for(int i = 0; i < 5; i++) {
    setLEDColors(255, 0, 0);  // Red
    delay(250);
    setLEDColors(0, 0, 255);  // Blue
    delay(250);
  }
  setLEDColors(currentRed, currentGreen, currentBlue);
}

void displayRainbow() {
  for(int i = 0; i < 256; i++) {
    setLEDColors(255 - i, i, 0);
    delay(5);
  }
  for(int i = 0; i < 256; i++) {
    setLEDColors(0, 255 - i, i);
    delay(5);
  }
  for(int i = 0; i < 256; i++) {
    setLEDColors(i, 0, 255 - i);
    delay(5);
  }
  setLEDColors(currentRed, currentGreen, currentBlue);
}

void displayStrobe() {
  for(int i = 0; i < 10; i++) {
    setLEDColors(255, 255, 255);  // White
    delay(50);
    setLEDColors(0, 0, 0);        // Off
    delay(50);
  }
  setLEDColors(currentRed, currentGreen, currentBlue);
}