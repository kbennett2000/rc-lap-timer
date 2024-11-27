import RPi.GPIO as GPIO
import time
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS


# Configuration
IR_PIN_1 = 17
IR_PIN_2 = 18
MAX_CARS = 8

START_PULSE_MAX = 0.008
START_PULSE_MIN = 0.003
PULSE_COUNT_WINDOW = 0.02  # Increased for higher car IDs
DETECTION_INTERVAL = 0.02
VALIDATION_READINGS = 6

START_PULSE_MAX_MS = START_PULSE_MAX * 1000
START_PULSE_MIN_MS = START_PULSE_MIN * 1000
INTER_PULSE_DELAY = 0.0002  # Reduced to 0.2ms
POST_START_DELAY = 0.001  # Reduced to 1ms
LOOP_DELAY = 0.0001

# Set up the Flask app and enable CORS
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins for testing

# Set up GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup([IR_PIN_1, IR_PIN_2], GPIO.IN)

# Global variable to store current car detection details
current_car = {'id': None, 'time': None}

def decode_pulses(pin):
    if GPIO.input(pin):
        return None
        
    start = time.time()
    while not GPIO.input(pin) and (time.time() - start < START_PULSE_MAX):
        pass
    
    pulse_len = (time.time() - start) * 1000
    if not (START_PULSE_MIN_MS <= pulse_len <= START_PULSE_MAX_MS):
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
    
    return pulses if 1 <= pulses <= MAX_CARS else None

def validate_car_id(detector_id, car_id):
    global recent_readings
    if detector_id not in recent_readings:
        recent_readings[detector_id] = []
        
    readings = recent_readings[detector_id]
    readings.append(car_id)
    if len(readings) > VALIDATION_READINGS:
        readings.pop(0)
        
    if len(readings) == VALIDATION_READINGS and readings.count(car_id) >= (VALIDATION_READINGS - 1):
        return car_id
    return None

# Flask route to get the current car data
@app.route('/current_car')
def current_car_data():
    return jsonify(current_car)

# Main detection loop
def start_detection():
    global current_car, recent_readings, last_detection
    recent_readings = {}
    last_detection = {1: 0, 2: 0}
    
    try:
        print("IR Car Detector - High Speed Version")
        print("Press Ctrl+C to exit")
        
        while True:
            for detector_id, pin in [(1, IR_PIN_1), (2, IR_PIN_2)]:
                car_id = decode_pulses(pin)
                if car_id:
                    validated_id = validate_car_id(detector_id, car_id)
                    if validated_id:
                        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        if time.time() - last_detection[detector_id] > DETECTION_INTERVAL:
                            print(f"Car {validated_id} detected on sensor {detector_id} at {current_time}")
                            current_car = {'id': str(validated_id), 'time': current_time}
                            last_detection[detector_id] = time.time()
            time.sleep(LOOP_DELAY)

    except KeyboardInterrupt:
        print("\nStopping...")
        GPIO.cleanup()

if __name__ == '__main__':
    from threading import Thread
    
    # Start the car detection in a separate thread
    detection_thread = Thread(target=start_detection)
    detection_thread.daemon = True
    detection_thread.start()
    
    # Start the Flask web server
    app.run(host='127.0.0.1', port=5000)

