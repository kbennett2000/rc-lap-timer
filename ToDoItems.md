# Items to do:
- Make Best Laps Comparison a component like Session Comparison

- Tab UI:
    - TAB1
        - Session Configuration / Stopwatch
        - Last Three Previous Sessions
        - See all Sessions Link
    - TAB2
        - All Previous Sessions
    - TAB3
        - Best Laps Comparison
    - TAB4
        - Session Comparison

- Add Total Session Time to statistics being tracked, stored, and displayed for each session
- Add a feature to add penalties for each lab. 
    - Penalties should be tracked with the rest of the other statistics. 
    - A penalty could include going outside your lane, having to be marshaled, or doing something against the rules. 
- Add animation when user clicks "Start Lap Timer"
- Add animation when user clicks "Record Lap"
- Add animation when user clicks "Stop Lap Timer"
- Add the ability for multiple users to use this app at the same time. Each use will be timing a different driver.

# Other things to add:
- Add more statistical information?
- Add more statistical analysis?
- Add charts or graphs for visualization?

# Statistics and Analysis:
- Driver/car performance trends
- Lap time graphs using recharts

# Advanced Session Management:
- Session categories/tags
- Session notes/comments
- Session search and filtering
- Date range filtering

# Export Enhancements:
- Export to CSV format
- PDF report generation
- Session sharing capabilities
- Backup automation

# UI Improvements:
- Dark mode support
- Mobile-responsive optimizations
- Keyboard shortcuts
- Sound effects for buttons/actions

# Additional Features:
- Multiple timer modes (practice, race, qualifying)
- Split times within laps
- Pit stop tracking
- Weather conditions recording

# Deployment:
- RPI image
    - initial configuration UI
    - add to local home network
    - address by name or static local IP?
    - access via browser on mobile device
    - instructions for field use including battery powered wifi router
        - RPI hosted WiFi:
        # Setting Up a Raspberry Pi to Host a Wi-Fi Network for a React Web Application
        ## Requirements:
        - **Raspberry Pi 3, 4, or Zero W** (which have built-in Wi-Fi).
        - **MicroSD card with Raspberry Pi OS**.
        - **Power supply for the Raspberry Pi**.
        - **React web application** ready for deployment.
        - **Optional: USB Ethernet adapter** if you want to provide internet access to devices connected to the Pi’s Wi-Fi.

        ## Steps:

        ### 1. Set up Raspberry Pi OS
        #### Install Raspberry Pi OS using the Raspberry Pi Imager or another tool.
        #### Connect to the Pi via SSH or a monitor and keyboard.

        ### 2. Install and Configure the Web Server
        #### Install `nginx` or another lightweight web server.
        ```bash
        sudo apt update
        sudo apt install nginx
        ```
        #### Place your React web app files in the `/var/www/html/` directory.

        ### 3. Install and Configure Hostapd and Dnsmasq
        #### Install the necessary software to make the Pi a Wi-Fi access point:
        ```bash
        sudo apt install hostapd dnsmasq
        ```

        ### 4. Configure Hostapd (Wi-Fi Access Point)
        #### Edit the hostapd configuration file:
        ```bash
        sudo nano /etc/hostapd/hostapd.conf
        ```
        #### Add this configuration:
        ```
        interface=wlan0
        driver=nl80211
        ssid=YourNetworkName
        hw_mode=g
        channel=7
        wmm_enabled=0
        macaddr_acl=0
        auth_algs=1
        ignore_broadcast_ssid=0
        wpa=2
        wpa_passphrase=YourSecurePassword
        wpa_key_mgmt=WPA-PSK
        rsn_pairwise=CCMP
        ```
        #### Update the hostapd default config:
        ```bash
        sudo nano /etc/default/hostapd
        ```
        #### Un-comment and set the DAEMON_CONF line:
        ```
        DAEMON_CONF="/etc/hostapd/hostapd.conf"
        ```

        ### 5. Configure Dnsmasq (DHCP server)
        #### Backup the original dnsmasq configuration:
        ```bash
        sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
        ```
        #### Create a new configuration file:
        ```bash
        sudo nano /etc/dnsmasq.conf
        ```
        #### Add the following content:
        ```
        interface=wlan0
        dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
        ```

        ### 6. Configure Network Settings
        #### Update your `/etc/dhcpcd.conf` to assign a static IP to the wlan0 interface:
        ```bash
        sudo nano /etc/dhcpcd.conf
        ```
        #### Add:
        ```
        interface wlan0
        static ip_address=192.168.4.1/24
        nohook wpa_supplicant
        ```

        ### 7. Enable IP Forwarding
        #### Enable packet forwarding for IPv4:
        ```bash
        sudo nano /etc/sysctl.conf
        ```
        #### Un-comment the line:
        ```
        net.ipv4.ip_forward=1
        ```

        ### 8. Start the Access Point
        #### Restart services:
        ```bash
        sudo systemctl restart dhcpcd
        sudo systemctl start hostapd
        sudo systemctl start dnsmasq
        ```

        ### 9. Test the Setup
        #### The Raspberry Pi should now be broadcasting a Wi-Fi network with the name you set in `hostapd.conf`.
        #### Users can connect their mobile devices to the Pi’s Wi-Fi network and access the React web app via the Pi’s IP address (e.g., `192.168.4.1`).