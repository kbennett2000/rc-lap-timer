#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <IRremote.h>
#include <EEPROM.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

#define BUTTON_PIN 2
#define IR_LED_PIN 9

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool displayPresent = false;

int maxCars = 8;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;
int carID;

void setup()
{
    displayPresent = display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS);
    if (displayPresent)
    {
        display.clearDisplay();
        display.setTextSize(2);
        display.setTextColor(SSD1306_WHITE);
    }

    pinMode(BUTTON_PIN, INPUT_PULLUP);
    IrSender.begin(IR_LED_PIN);

    carID = EEPROM.read(0);
    if (carID < 1 || carID > maxCars)
    {
        carID = 1;
    }

    updateDisplay();
}

void loop()
{
    int reading = digitalRead(BUTTON_PIN);

    if (reading != lastButtonState)
    {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay)
    {
        if (reading == LOW && displayPresent)
        {
            carID = (carID % maxCars) + 1;
            EEPROM.update(0, carID);
            updateDisplay();
            delay(100);
        }
    }

    lastButtonState = reading;

    tone(IR_LED_PIN, 38000);
    delay(5);
    noTone(IR_LED_PIN);
    delay(2);

    for (int i = 0; i < carID; i++)
    {
        tone(IR_LED_PIN, 38000);
        delay(1);
        noTone(IR_LED_PIN);
        delay(1);
    }

    delay(20);
}

void updateDisplay()
{
    if (displayPresent)
    {
        display.clearDisplay();
        display.setCursor(0, 10);
        display.print("CAR: ");
        display.println(carID);
        display.display();
    }
}