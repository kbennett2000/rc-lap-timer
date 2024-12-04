import RPi.GPIO as GPIO
import time
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS

# Configuration
IR_PIN_1 = 17
IR_PIN_2 = 18
MAX_CARS = 8

# LED PIN Configuration
RED_PIN = 12
GREEN_PIN = 13
BLUE_PIN = 19

START_PULSE_MAX = 0.008
START_PULSE_MIN = 0.003
PULSE_COUNT_WINDOW = 0.02
DETECTION_INTERVAL = 0.02
VALIDATION_READINGS = 4
FIRST_LOOP = 0

START_PULSE_MAX_MS = START_PULSE_MAX * 1000
START_PULSE_MIN_MS = START_PULSE_MIN * 1000
INTER_PULSE_DELAY = 0.0002
POST_START_DELAY = 0.001
LOOP_DELAY = 0.0001

# Set up the Flask app and enable CORS
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Set up GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup([IR_PIN_1, IR_PIN_2], GPIO.IN)
GPIO.setup([RED_PIN, GREEN_PIN, BLUE_PIN], GPIO.OUT)

# Set up PWM for LED control
pwm_red = GPIO.PWM(RED_PIN, 100)    # 100 Hz frequency
pwm_green = GPIO.PWM(GREEN_PIN, 100)
pwm_blue = GPIO.PWM(BLUE_PIN, 100)

# Start PWM with 0% duty cycle
pwm_red.start(0)
pwm_green.start(0)
pwm_blue.start(0)

# Global variable to store current car detection details
current_car = {'id': None, 'time': None}

def set_led_color(red, green, blue):
    """
    Set RGB LED color using PWM values (0-100)
    """
    pwm_red.ChangeDutyCycle(red)
    pwm_green.ChangeDutyCycle(green)
    pwm_blue.ChangeDutyCycle(blue)

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

def validate_car_id(detector_id, car_id):
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

    if len(recent_readings[car_id]['readings']) >= VALIDATION_READINGS:
        return car_id
   
    return None

# Flask route to get the current car data
@app.route('/current_car')
def current_car_data():
    return jsonify(current_car)

# New route to control LED color
@app.route('/led/<int:red>/<int:green>/<int:blue>')
def set_led(red, green, blue):
    # Ensure values are between 0 and 100
    red = max(0, min(100, red))
    green = max(0, min(100, green))
    blue = max(0, min(100, blue))
    
    set_led_color(red, green, blue)
    return jsonify({'status': 'success', 'color': {'red': red, 'green': green, 'blue': blue}})

# Main detection loop
def start_detection():
    global current_car, recent_readings, last_detection
    recent_readings = {}
    last_detection = {1: 0, 2: 0}

    # Startup Sequence
    # Red
    set_led_color(100, 0, 0)
    time.sleep(1)
    # Green
    set_led_color(0, 100, 0)
    time.sleep(1)
    # Blue Status
    set_led_color(0, 0, 25)
    
    try:
        while True:
            current_car = {'id': None, 'time': None}
            for detector_id, pin in [(1, IR_PIN_1), (2, IR_PIN_2)]:
                car_id = decode_pulses(pin)
                if car_id:
                    validated_id = validate_car_id(detector_id, car_id)
                    if validated_id:
                        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        if time.time() - last_detection[detector_id] > DETECTION_INTERVAL:
                            current_car = {'id': str(validated_id), 'time': current_time}
                            last_detection[detector_id] = time.time()

            time.sleep(LOOP_DELAY)

    except KeyboardInterrupt:
        # Turn off LEDs and clean up
        set_led_color(0, 0, 0)
        pwm_red.stop()
        pwm_green.stop()
        pwm_blue.stop()
        GPIO.cleanup()

if __name__ == '__main__':
    from threading import Thread
    
    # Start the car detection in a separate thread
    detection_thread = Thread(target=start_detection)
    detection_thread.daemon = True
    detection_thread.start()
    
    # Start the Flask web server
    app.run(host='127.0.0.1', port=5000)