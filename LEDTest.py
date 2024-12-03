import RPi.GPIO as GPIO
import time

# GPIO pin setup
RED_PIN = 12
GREEN_PIN = 13
BLUE_PIN = 19

# Setup GPIO mode
GPIO.setmode(GPIO.BCM)
GPIO.setup(RED_PIN, GPIO.OUT)
GPIO.setup(GREEN_PIN, GPIO.OUT)
GPIO.setup(BLUE_PIN, GPIO.OUT)

# Function to turn off all LEDs
def turn_off_all():
    GPIO.output(RED_PIN, GPIO.LOW)
    GPIO.output(GREEN_PIN, GPIO.LOW)
    GPIO.output(BLUE_PIN, GPIO.LOW)

try:
    while True:
        # Red LED
        print("Red ON")
        GPIO.output(RED_PIN, GPIO.HIGH)
        time.sleep(1)
        GPIO.output(RED_PIN, GPIO.LOW)

        # Green LED
        print("Green ON")
        GPIO.output(GREEN_PIN, GPIO.HIGH)
        time.sleep(1)
        GPIO.output(GREEN_PIN, GPIO.LOW)

        # Blue LED
        print("Blue ON")
        GPIO.output(BLUE_PIN, GPIO.HIGH)
        time.sleep(1)
        GPIO.output(BLUE_PIN, GPIO.LOW)

except KeyboardInterrupt:
    print("Exiting program...")

finally:
    # Clean up GPIO state on exit
    turn_off_all()
    GPIO.cleanup()
