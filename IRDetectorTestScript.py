import RPi.GPIO as GPIO
import time
from datetime import datetime

# Configuration
IR_PIN_1 = 17
IR_PIN_2 = 18
MAX_CARS = 8
START_PULSE_MAX = 0.008
START_PULSE_MIN = 0.003
PULSE_COUNT_WINDOW = 0.02
DETECTION_INTERVAL = 0.02
VALIDATION_READINGS = 1

START_PULSE_MAX_MS = START_PULSE_MAX * 1000
START_PULSE_MIN_MS = START_PULSE_MIN * 1000
INTER_PULSE_DELAY = 0.0002
POST_START_DELAY = 0.001
LOOP_DELAY = 0.0001

# Set up GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup([IR_PIN_1, IR_PIN_2], GPIO.IN)

def decode_pulses(pin):
   if GPIO.input(pin):
       return None
       
   start = time.time()
   while not GPIO.input(pin) and (time.time() - start < START_PULSE_MAX):
       pass
   
   pulse_len = (time.time() - start) * 1000
   if not (START_PULSE_MIN_MS <= pulse_len <= START_PULSE_MAX_MS):
       print(f"Invalid pulse length: {pulse_len:.2f}ms")
       return None
       
   time.sleep(POST_START_DELAY)
   
   pulses = 0
   pulse_start = time.time()
   while time.time() - pulse_start < PULSE_COUNT_WINDOW:
       if not GPIO.input(pin):
           pulses += 1
           while not GPIO.input(pin) and (time.time() - pulse_start < PULSE_COUNT_WINDOW):
               pass
           time.sleep(INTER_PULSE_DELAY)
   
   print(f"Pulses detected: {pulses}")
   return pulses if 1 <= pulses <= MAX_CARS else None

def validate_car_id(detector_id, car_id):
   global recent_readings
   current_time = time.time()

   if car_id not in recent_readings:
       recent_readings[car_id] = {
           'readings': [],
           'last_time': current_time
       }
       print(f"New car {car_id} detected")

   if current_time - recent_readings[car_id]['last_time'] > 1.0:
       print(f"Clearing old readings for car {car_id}")
       recent_readings[car_id]['readings'].clear()

   recent_readings[car_id]['last_time'] = current_time
   recent_readings[car_id]['readings'].append(detector_id)
   print(f"Car {car_id} readings: {recent_readings[car_id]['readings']}")

   if len(recent_readings[car_id]['readings']) >= VALIDATION_READINGS:
       print(f"Car {car_id} validated!")
       return car_id
   
   return None

def main():
   global recent_readings
   recent_readings = {}
   last_detection = {1: 0, 2: 0}
   
   print("IR Car Detector - Debug Version")
   print("Press Ctrl+C to exit")
   
   try:
       while True:
           for detector_id, pin in [(1, IR_PIN_1), (2, IR_PIN_2)]:
               car_id = decode_pulses(pin)
               if car_id:
                   print(f"Raw detection: Car {car_id} on detector {detector_id}")
                   validated_id = validate_car_id(detector_id, car_id)
                   if validated_id:
                       current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                       if time.time() - last_detection[detector_id] > DETECTION_INTERVAL:
                           print(f"CONFIRMED: Car {validated_id} on detector {detector_id} at {current_time}")
                           last_detection[detector_id] = time.time()

           time.sleep(LOOP_DELAY)

   except KeyboardInterrupt:
       print("\nStopping...")
       GPIO.cleanup()

if __name__ == '__main__':
   main()