# TO USE:
# python IRDetectorTestScript.py --validation-readings 6
# Note: will default to 4 validation readings if nothing is specified

import RPi.GPIO as GPIO
import time
from datetime import datetime
import argparse

# Configuration
IR_PIN_1 = 17
IR_PIN_2 = 18
MAX_CARS = 8
START_PULSE_MAX = 0.008
START_PULSE_MIN = 0.003
PULSE_COUNT_WINDOW = 0.02
DETECTION_INTERVAL = 0.02
START_PULSE_MAX_MS = START_PULSE_MAX * 1000
START_PULSE_MIN_MS = START_PULSE_MIN * 1000
INTER_PULSE_DELAY = 0.0002
POST_START_DELAY = 0.001
LOOP_DELAY = 0.0001

# Set up GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup([IR_PIN_1, IR_PIN_2], GPIO.IN)

# detection counter dictionary
car_detection_counts = {i: 0 for i in range(1, MAX_CARS + 1)}

def count_subsequent_pulses(pin):
    pulses = 0
    pulse_start = time.time()
    
    while time.time() - pulse_start < PULSE_COUNT_WINDOW:
        if not GPIO.input(pin):
            pulses += 1
            while not GPIO.input(pin) and (time.time() - pulse_start < PULSE_COUNT_WINDOW):
                pass
            time.sleep(INTER_PULSE_DELAY)
    
    return pulses

def decode_pulses(pin):
    if GPIO.input(pin):
        return None
        
    start = time.time()
    while not GPIO.input(pin) and (time.time() - start < START_PULSE_MAX):
        pass
    
    pulse_len = (time.time() - start) * 1000  # milliseconds
    if not (START_PULSE_MIN_MS <= pulse_len <= START_PULSE_MAX_MS):
        return None
        
    time.sleep(0.005)  # 5ms gap
    
    # Measure ID pulse in milliseconds
    id_start = time.time()
    while not GPIO.input(pin):
        if time.time() - id_start > 0.01:  # 10ms timeout
            return None
    id_len = (time.time() - id_start) * 1000
    
    # Map 8ms->1 to 1->8 car IDs
    estimated_id = 9 - int(round(id_len))
    if not (1 <= estimated_id <= MAX_CARS):
        return None
        
    # Verify with pulse count
    pulses = count_subsequent_pulses(pin)
    if pulses != estimated_id:
        return None
        
    return estimated_id

def validate_car_id(detector_id, car_id, validation_readings):
    global recent_readings
    current_time = time.time()
    
    if car_id not in recent_readings:
        recent_readings[car_id] = {
            'readings': [],
            'last_time': current_time
        }
        
    if current_time - recent_readings[car_id]['last_time'] > 1.0:
        recent_readings[car_id]['readings'].clear()
        
    recent_readings[car_id]['last_time'] = current_time
    recent_readings[car_id]['readings'].append(detector_id)
    
    if len(recent_readings[car_id]['readings']) >= validation_readings:
        return car_id
    return None

def print_detection_summary():
    print("\nDetection Summary:")
    print("-----------------")
    for car_id, count in car_detection_counts.items():
        print(f"Car {car_id}: {count} detections")

def main(validation_readings):
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
                    validated_id = validate_car_id(detector_id, car_id, validation_readings)
                    if validated_id:
                        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        if time.time() - last_detection[detector_id] > DETECTION_INTERVAL:
                            print(f"CONFIRMED: Car {validated_id} on detector {detector_id} at {current_time}")
                            car_detection_counts[validated_id] += 1
                            last_detection[detector_id] = time.time()
            time.sleep(LOOP_DELAY)
            
    except KeyboardInterrupt:
        print("\nStopping...")
        print_detection_summary()
        GPIO.cleanup()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="IR Car Detector Script")
    parser.add_argument(
        '--validation-readings', type=int, default=4,
        help='Number of validation readings required for a confirmed detection'
    )
    args = parser.parse_args()
    main(args.validation_readings)