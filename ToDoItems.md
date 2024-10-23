# Items to do:

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
        `I would like to setup a raspberry pi to run a react web application for use in the field. users will connect to a wifi network and use the application via their mobile phones. does the raspberry pi have the ability to host the wifi network or do i need a portable router?`
        
        # Setting Up a Raspberry Pi to Host a Wi-Fi Network for a React Web Application

        Yes, a Raspberry Pi can host a Wi-Fi network by creating a wireless access point (AP). You don't necessarily need a portable router, though adding one could provide better performance, range, and stability, depending on your needs.

        Here’s an overview of how you can set up a Raspberry Pi as a Wi-Fi access point to run your React web application:

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

        ## Pros of Using a Portable Router:
        #### **Better Range and Performance**: If you need strong Wi-Fi coverage or have many users, a portable router may offer more reliable performance than a Raspberry Pi.
        #### **Simpler Management**: Some portable routers have built-in features like multiple SSIDs, better security, and more advanced configuration options.

        However, for small-scale use cases with a few users, the Raspberry Pi should be sufficient.
