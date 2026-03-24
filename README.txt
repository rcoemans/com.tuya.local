Tuya Direct — local LAN control for compatible Tuya-based devices on Homey Pro.

Connect devices directly over your local network using their device ID, local key and datapoints for faster status updates and cloud-independent control.

Features:
- 5 device drivers: Socket, Light, Fan, Climate, Air Purifier
- Socket: on/off, power (W), energy (kWh), current (A), voltage (V)
- Light: on/off, brightness, color temperature, hue, saturation, light mode
- Fan: on/off, speed control
- Climate: on/off, target temperature, measured temperature
- Air Purifier: on/off, mode, fan speed, PM2.5, air quality, filter life, child lock, ionizer
- Persistent TCP connection with heartbeat and automatic reconnect
- Fallback polling when push updates are unreliable
- Protocol support: 3.1, 3.2, 3.3, 3.4, 3.5
- Custom pairing flow with connection validation and datapoint discovery
- Repair flow for updating host, local key, or protocol version
- 3 flow trigger cards: device connected, device disconnected, datapoint changed
- 2 flow condition cards with inversion support: device is/is not connected, datapoint value is/is not equal to
- 2 flow action cards: set datapoint value, refresh device status
- Advanced DP-level flow cards for direct datapoint control
- Fully localized in English and Dutch (Nederlands)

Supported devices:
- Tuya-based Wi-Fi smart plugs, switches, power strips
- Tuya-based Wi-Fi smart bulbs, LED strips, dimmers
- Tuya-based Wi-Fi fans and ventilation controllers
- Tuya-based Wi-Fi thermostats, heaters, AC controllers
- Tuya-based Wi-Fi air purifiers

Setup:
1. Install the app on your Homey
2. Add a new device: Tuya Direct > Socket / Light / Fan / Climate / Air Purifier
3. Enter device credentials: host (IP address), device ID, local key, protocol version
4. The app validates the connection and discovers available datapoints
5. Confirm the device to complete pairing
6. Connection settings can be changed later in device Settings

Known limitations:
- Device ID and local key must be obtained from the Tuya IoT Platform or tinytuya
- Many Tuya devices allow only one local TCP connection at a time
- Re-pairing in Tuya/Smart Life app may change the local key
- Battery-powered Wi-Fi Tuya devices often do not work reliably over local LAN
- Datapoint numbers vary per device model; manual configuration may be required
- Not all Tuya devices support local LAN control
