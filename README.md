# Tuya Direct

[![Homey App](https://img.shields.io/badge/Homey-App%20Store-00A6A6?logo=homey)](https://homey.app/en-nl/app/com.tuya.local/Tuya-Direct/)
[![Homey App Test](https://img.shields.io/badge/Homey-Test%20App-FFA500?logo=homey)](https://homey.app/en-nl/app/com.tuya.local/Tuya-Direct/test/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

> App has not yet been submitted for certification but is available via [test](https://homey.app/en-nl/app/com.tuya.local/Tuya-Direct/test/) link.

Homey app for **local LAN control** of compatible Tuya-based devices on Homey Pro. Connect devices directly over your local network using their device ID, local key and datapoints for faster status updates and cloud-independent control.

## Disclaimer

> **This is an unofficial, community-developed integration.**
>
> - Not affiliated with, endorsed by, or supported by **Tuya Inc.**
> - Tuya may change device firmware or protocols at any time without notice — app functionality may break as a result.
> - Not all Tuya-based devices support local LAN control.
> - Use at your own risk. The developers accept no liability for data loss, incorrect readings, or unintended device behaviour.

## Supported Devices

This app supports **Tuya-based Wi-Fi devices** that expose local LAN control via the Tuya protocol. Devices are categorized into the following driver types:

| Driver   | Homey Class  | Typical Devices                          |
|----------|-------------|------------------------------------------|
| Socket       | `socket`    | Smart plugs, power strips, switches           |
| Light        | `light`     | Smart bulbs, LED strips, dimmers              |
| Fan          | `fan`       | Smart fans, ventilation controllers           |
| Climate      | `thermostat`| Thermostats, heaters, AC controllers          |
| Air Purifier | `fan`       | Air purifiers with PM2.5, ionizer, speed, mode|
| Humidifier   | `fan`       | Smart humidifiers with mist level, target humidity |
| Dehumidifier | `fan`       | Smart dehumidifiers with fan speed, mode, anion|

## Roadmap

Table below shows Tuya categories which are suitable for local LAN control and integration with Homey.

| Category       | Tuya Category | Local LAN? | Good Fit for Homey?   | Complexity |
|----------------|---------------|------------|-----------------------|------------|
| Curtain/Blind  | cl            | ✅ Yes      | ✅ Good                | Low-Medium |
| Garage Door    | ckmkzq        | ✅ Yes      | ✅ Good                | Low        |
| Robot Vacuum   | sd            | ✅ Yes      | ⚠️ Complex             | High       |
| Siren/Alarm    | sgbj          | ✅ Yes      | ✅ Good                | Low        |
| Aroma Diffuser | xxj           | ✅ Yes      | ⚠️ Niche               | Low        |
| Heater         | qn            | ✅ Yes      | ✅ Good (like climate) | Low        |
| Smart Kettle   | —             | ✅ Yes      | ⚠️ Niche               | Low        |

## Requirements

- **Homey Pro** (local platform only)
- Tuya device connected to your **local Wi-Fi network**
- Device **ID**, **local key**, and **protocol version** (obtainable from the Tuya IoT Platform or tools like [tinytuya](https://github.com/jasonacox/tinytuya))
- Network access from Homey to the Tuya device IP address

## Installation

### Via Homey App Store

Search for **"Tuya Direct"** in the Homey App Store.

### Via CLI (sideloading / development)

```bash
npm install -g homey
git clone https://github.com/rcoemans/com.tuya.local
cd com.tuya.local
npm install
npm run build
homey login
homey app install
```

## Setup

1. Install the app on your Homey.
2. Add a new device and select the appropriate driver: **Tuya Direct → Socket / Light / Fan / Climate**.
3. Enter the **device credentials**:
   - **Host** — IP address of the Tuya device on your local network
   - **Device ID** — unique Tuya device identifier
   - **Local Key** — 16-character encryption key
   - **Protocol Version** — typically 3.3 or 3.4
   - **Node ID** — only needed for sub-devices behind a Tuya hub
4. The app validates the connection and discovers available datapoints.
5. Confirm the device to complete pairing.
6. The device will connect automatically and start reading data.
7. You can change connection settings later in the device **Settings** page.

## How to Find Your Device Credentials

The device ID and local key are not visible in the Tuya/Smart Life mobile app. You need to obtain them from the **Tuya IoT Platform** or use a tool like **tinytuya**:

1. Create a Tuya IoT Platform account at [iot.tuya.com](https://iot.tuya.com)
2. Link your Smart Life / Tuya Smart account
3. Find your devices and note their **Device ID** and **Local Key**

Alternatively, use [tinytuya](https://github.com/jasonacox/tinytuya):
```bash
pip install tinytuya
python -m tinytuya wizard
```

## Capabilities per Driver

### Socket
- **On/Off** — switch control (DP 1)
- **Power** — real-time power consumption in W (DP 19)
- **Energy** — cumulative energy in kWh (DP 17)
- **Current** — electrical current in A (DP 18)
- **Voltage** — voltage in V (DP 20)

### Light
- **On/Off** — switch control (DP 20)
- **Dim** — brightness level (DP 22)
- **Color temperature** — warm to cool white (DP 23)
- **Hue** — color hue (DP 24)
- **Saturation** — color saturation (DP 25)
- **Light mode** — white/color mode (DP 21)

### Fan
- **On/Off** — switch control (DP 1)
- **Speed** — fan speed as dim percentage (DP 3)

### Climate
- **On/Off** — switch control (DP 1)
- **Target temperature** — setpoint (DP 2)
- **Measured temperature** — current reading (DP 3)

> **Note:** Datapoint numbers vary per device. The numbers above are common defaults. You can customize the DP mapping in the device store during or after pairing.

## Flow Cards

### Triggers (WHEN…)

| Trigger               | Description                                         |
|-----------------------|-----------------------------------------------------|
| Device connected      | Fires when the device establishes a local connection |
| Device disconnected   | Fires when the device loses its local connection     |
| A datapoint changed   | Fires when a specific DP value changes (with value token) |

### Conditions (AND…)

| Condition                              | Description                                            |
|----------------------------------------|--------------------------------------------------------|
| Device is / is not connected           | Checks if the device has an active local connection    |
| Datapoint value is / is not equal to   | Checks if a specific DP has a given value              |

### Actions (THEN…)

| Action                  | Description                                           |
|-------------------------|-------------------------------------------------------|
| Set datapoint value     | Set a specific DP to a value (boolean, number, string)|
| Refresh device status   | Request a fresh status update from the device          |

## Device Settings

| Setting           | Default | Description                                      |
|-------------------|---------|--------------------------------------------------|
| Host              | —       | IP address or hostname of the Tuya device        |
| Device ID         | —       | Unique Tuya device identifier                    |
| Local Key         | —       | 16-character local encryption key                |
| Protocol Version  | auto    | Tuya protocol version (3.1, 3.2, 3.3, 3.4, 3.5) |
| Node ID           | —       | Sub-device node ID (for hub-connected devices)   |
| Poll Interval     | 30      | Fallback polling interval in seconds             |

## Protocol Support

| Version | Status        | Encryption                    | Notes                                                                     |
|---------|---------------|-------------------------------|---------------------------------------------------------------------------|
| 3.1     | Supported     | AES-128-ECB + Base64          | Older devices                                                             |
| 3.2     | Supported     | AES-128-ECB + Base64          | Less common                                                               |
| 3.3     | Supported     | AES-128-ECB + CRC32           | Most common for current devices                                           |
| 3.4     | ✅ **Proven**  | AES-128-ECB + HMAC-SHA256     | Newer devices with session key negotiation — **fully tested and working** |
| 3.5     | Supported     | AES-128-GCM + HMAC-SHA256     | Latest protocol with session key and GCM encryption                       |

### Protocol 3.4 — Proven Working

**Tuya protocol 3.4 has been thoroughly tested and is confirmed working** with the following implementation details:

- **Session Key Negotiation**: Full SESS_KEY_NEG_START/RESP/FINISH handshake with HMAC-SHA256 verification
- **Encryption**: AES-128-ECB with manual PKCS7 padding (no auto-padding)
- **Frame Format**: 55AA prefix, HMAC-SHA256 footer (32 bytes) instead of CRC32
- **Payload Structure**: Version header (3.4 + 12 zero bytes) for non-session commands
- **Commands Tested**: DP_QUERY_NEW, CONTROL_NEW, STATUS, HEART_BEAT
- **Device Example**: Tuya dehumidifier with capabilities: on/off, mode, target humidity (30-90%), fan speed, measured humidity/temperature

**Known Working Devices**:
- Tuya dehumidifiers (tested with protocol 3.4, local key negotiation, and full DP control)

## Known Limitations

| Limitation                     | Description                                                                                   |
|--------------------------------|-----------------------------------------------------------------------------------------------|
| **Local network only**         | The device must be reachable on your local network. No cloud/remote access.                   |
| **Manual credentials**         | Device ID and local key must be obtained manually from the Tuya IoT Platform or tinytuya.     |
| **Single connection**          | Many Tuya devices allow only one local TCP connection at a time.                              |
| **Local key changes**          | Re-pairing a device in the Tuya/Smart Life app may generate a new local key.                  |
| **Battery devices**            | Battery-powered Wi-Fi Tuya devices often do not work reliably over local LAN control.         |
| **Not all devices supported**  | Some Tuya devices do not support local LAN control or use unsupported protocols.              |
| **DP mapping varies**          | Datapoint numbers differ per device model. Manual configuration may be required.              |

## Security Considerations

- **Network**: Communication uses AES-128 encryption with the device's local key. All traffic stays on your local network.
- **Local key**: Stored in Homey device settings (not in plain data). Keep it confidential.
- **No external connections**: The app makes no cloud or internet calls. All communication is local.

## Technical Details

- **Protocol**: Tuya local LAN protocol (TCP)
- **SDK**: Homey SDK v3
- **Language**: TypeScript
- **Connection**: Persistent TCP socket with heartbeat
- **Fallback**: Configurable polling interval when push updates are unreliable
- **Reconnect**: Automatic reconnection with exponential backoff
- **Languages**: English (en), Nederlands (nl)

## Credits & Acknowledgements

This app draws inspiration from the excellent work of:
- [**localtuya**](https://github.com/rospogrigio/localtuya) — transport handling and session negotiation
- [**tuya-local**](https://github.com/make-all/tuya-local) — device profile mapping and configuration approach
- [**tinytuya**](https://github.com/jasonacox/tinytuya) — protocol constants and command framing reference

This app is a co-creation between **Robert Coemans** and **Claude** (Anthropic), built using **[Windsurf](https://windsurf.com)** — an AI-powered IDE for collaborative software development.

If you like this, consider [buying me a coffee](https://buymeacoffee.com/kabxpqqg7z).

Pull requests and issue reports are welcome on [GitHub](https://github.com/rcoemans/com.tuya.local/issues).
