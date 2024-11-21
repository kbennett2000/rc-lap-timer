#include <Wire.h>             // For I2C communication
#include <Adafruit_GFX.h>     // For OLED
#include <Adafruit_SSD1306.h> // For OLED

#define OLED_RESET -1 // For SSD1306
Adafruit_SSD1306 display(128, 32, &Wire, OLED_RESET);

#define RED_PIN 9
#define GREEN_PIN 10
#define BLUE_PIN 11
#define BUTTON_PIN 2

int config = 0;          // Configuration number
const int maxConfig = 6; // Number of configurations
unsigned long prevMillis = 0;
int blinkState = LOW;

void setup()
{
    pinMode(RED_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BLUE_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP); // Use internal pull-up resistor
}

void loop()
{
    blinkLED();
}

void blinkLED()
{
    static unsigned long prevMillis = 0;
    static bool ledState = LOW;
    static unsigned long lastConfigChange = 0;
    static bool duringPause = false;
    static bool redLedState = false;

    unsigned long currentMillis = millis();
    int frequency;
    int pin = BLUE_PIN;
    unsigned long interval;

    // Logic to change config every 10 seconds
    if (currentMillis - lastConfigChange >= 10000)
    {
        if (config < (maxConfig - 1))
        {
            // Pause for 1 second before changing config
            digitalWrite(pin, LOW); // Turn off blue LED during pause
            delay(1000);
            config++;
        }
        else
        {
            // Pause for 10 seconds with red LED on and blue LED off
            digitalWrite(RED_PIN, HIGH);
            digitalWrite(pin, LOW);
            redLedState = true;
            delay(10000);
            digitalWrite(RED_PIN, LOW);
            redLedState = false;
            config = 0; // Reset config after pause
        }
        currentMillis = millis();
        lastConfigChange = currentMillis;
        duringPause = true; // Flag that we are starting a new config or after a pause
    }

    // Determine pin and frequency based on config
    
    switch (config)
    {
    case 0:        
        frequency = 2;
        break;
    case 1:        
        frequency = 4;
        break;
    case 2:        
        frequency = 6;
        break;
    case 3:        
        frequency = 8;
        break;
    case 4:        
        frequency = 10;
        break;
    case 5:        
        frequency = 12;
        break;
    default:
        return; // Invalid config
    }

    // Calculate interval (in milliseconds)
    interval = 1000 / (2 * frequency); // Blink on/off cycle

    if (duringPause)
    {
        // If we are in the pause after config change, wait for 1 second
        delay(1000);
        duringPause = false;
    }
    else if (currentMillis - prevMillis >= interval && !redLedState)
    {
        prevMillis = currentMillis;
        ledState = !ledState;
        digitalWrite(pin, ledState); // Toggle the LED
    }
}
