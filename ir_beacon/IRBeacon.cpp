#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <IRremote.h>
#include <EEPROM.h> // Include EEPROM library

#define SCREEN_WIDTH 128    // OLED display width
#define SCREEN_HEIGHT 32    // OLED display height
#define OLED_RESET -1       // Reset pin (or -1 if sharing Arduino reset pin)
#define SCREEN_ADDRESS 0x3C // I2C address for display

#define BUTTON_PIN 2   // Push button pin
#define IR_LED_PIN 9   // IR LED pin
#define IR_LED2_PIN 10 // IR LED pin

// Initialize display
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

int maxCars = 8;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50; // Debounce time in milliseconds

int carID; // Car ID value

void setup()
{
    // Initialize OLED
    if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS))
    {
        while (1)
            ; // Don't proceed if display initialization fails
    }
    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(SSD1306_WHITE);

    // Initialize button pin with internal pullup
    pinMode(BUTTON_PIN, INPUT_PULLUP);

    // Initialize IR sender
    IrSender.begin(IR_LED_PIN);
    IrSender.begin(IR_LED2_PIN);

    // Load carID from EEPROM
    carID = EEPROM.read(0); // Read carID from EEPROM address 0
    if (carID < 1 || carID > maxCars)
    {
        carID = 1; // Default to 1 if the value is out of range
    }

    updateDisplay();

    Serial.begin(9600);
    Serial.println("IR Beacon - Car #" + String(carID));
}

void loop()
{

    // Read button with debouncing
    int reading = digitalRead(BUTTON_PIN);

    if (reading != lastButtonState)
    {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay)
    {
        if (reading == LOW)
        {                                  // Button pressed
            carID = (carID % maxCars) + 1; // Cycle through 1-maxCars
            EEPROM.update(0, carID);       // Save carID to EEPROM
            updateDisplay();
            delay(100); // Prevent multiple triggers
        }
    }

    lastButtonState = reading;

    // Send long start pulse
    tone(IR_LED_PIN, 38000);
    tone(IR_LED2_PIN, 38000);
    delay(5);
    noTone(IR_LED_PIN);
    noTone(IR_LED2_PIN);
    delay(2);

    // Send car ID number of short pulses
    for (int i = 0; i < carID; i++)
    {
        tone(IR_LED_PIN, 38000);
        tone(IR_LED2_PIN, 38000);
        delay(1);
        noTone(IR_LED_PIN);
        noTone(IR_LED2_PIN);
        delay(1);
    }

    delay(20);
}

void updateDisplay()
{
    display.clearDisplay();
    display.setCursor(0, 10);
    display.print("CAR: ");
    display.println(carID);
    display.display();
}
