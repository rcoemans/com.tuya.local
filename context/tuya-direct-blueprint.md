# Tuya Direct — Homey SDK 3 Blueprint

## 1) App identity

**Name:** Tuya Direct  
**App ID:** `com.tuya.local`  
**Description (SDK 3 / App Store style):**

> Adds local LAN control for compatible Tuya-based devices on Homey Pro. Connect devices directly over your local network using their device ID, local key and datapoints for faster status updates and cloud-independent control.

This description is intentionally careful: it does **not** imply support for all Tuya devices, and it avoids promising cloud independence in situations where the device firmware still phones home.

---

## 2) What the local Tuya API looks like

This blueprint is based on the behaviour documented and implemented across `rospogrigio/localtuya`, `make-all/tuya-local`, and `tinytuya`.

### Core concepts

A locally controlled Tuya device is usually addressed with:

- `device_id` / `devId`
- `local_key`
- device `ip` / host
- protocol version, commonly `3.1`, `3.2`, `3.3`, `3.4`, `3.5`
- one or more **DPs** (datapoints), such as:
  - DP `1` → on/off on many plugs and switches
  - DP `20` → on/off on many lights using newer product schemas
  - other DPs for brightness, colour mode, target temp, fan mode, power metering, etc.

### Message model

At a high level, the local protocol is:

1. Open a TCP socket to the device on the Tuya LAN port.
2. Send a framed command.
3. Encrypt the payload with the device's `local_key`.
4. Receive a framed response.
5. Decode JSON payload containing a `dps` object or an acknowledgement.

### Important command families

The common commands used by local implementations are:

- **HEART_BEAT** → keep connection alive
- **DP_QUERY / DP_QUERY_NEW** → fetch current datapoint values
- **CONTROL / CONTROL_NEW** → set datapoint values
- **UPDATEDPS** → request an async refresh for selected DPs
- **3.4+ session negotiation** → establish a session key before normal exchanges

### Data shape

The device state is exposed as datapoints, typically as JSON like:

```json
{
  "dps": {
    "1": true,
    "9": 0,
    "18": 2310,
    "19": 12,
    "20": 275
  }
}
```

### Practical protocol rules for the app

- Treat **DPs as the source of truth**.
- Expect **device-specific mapping** from DPs to user features.
- Maintain a **persistent socket per device** where possible.
- Support both:
  - **push-like updates** from the open socket
  - **fallback polling / refresh** when the device does not proactively publish enough state
- For protocol `3.4+`, negotiate a **session key** before normal status/control exchanges.
- Handle devices that allow **only one local client connection**.
- Never use IP address as Homey device identity; use `device_id` plus optional `node_id`.

### Constraints you should design around

- Some devices are **local-only workable**, others are not.
- Battery-powered Wi-Fi Tuya devices often do **not** work reliably over local LAN control.
- Subdevices behind hubs need the **hub connection details** plus a **node identifier**.
- Local keys can change after re-pairing in Tuya/Smart Life.
- Protocol auto-detection can be wrong; manual override is required.

---

## 3) Product decision for Homey

## Supported platform

This app should target **Homey Pro (local)** only.

Reason:
- Homey's Wi-Fi discovery and LAN connectivity are local-platform features.
- Homey Bridge / Homey Cloud do not support arbitrary local Wi-Fi device integrations in the same way.

## Connectivity model

Use driver connectivity:

- `platforms: ["local"]`
- `connectivity: "lan"`

## Pairing strategy

Use a **manual pairing-first** approach with optional assisted discovery.

Recommended order:

1. User chooses a device type template to add.
2. App tries to discover likely Tuya devices on LAN.
3. User can select a discovered host, or enter host manually.
4. User supplies:
   - host
   - device ID
   - local key
   - protocol version (`auto`, `3.1`, `3.2`, `3.3`, `3.4`, `3.5`)
   - optional `node_id`
5. App validates connection.
6. App queries DPs.
7. App maps DPs to a Homey driver profile.
8. App creates the Homey device.

This is more realistic than claiming zero-config pairing because Tuya LAN devices typically do **not** expose enough Homey-friendly metadata over standard Homey discovery methods alone.

---

## 4) Homey SDK 3 compliant app structure

```text
com.tuya.local/
├── .homeycompose/
│   ├── app.json
│   ├── capabilities/
│   │   ├── measure_current.json
│   │   ├── measure_voltage.json
│   │   └── tuya_work_mode.json
│   └── discovery/
│       └── tuya-mac.json
├── app.js
├── lib/
│   ├── tuya/
│   │   ├── constants.js
│   │   ├── cipher.js
│   │   ├── protocol.js
│   │   ├── connection.js
│   │   ├── mapper.js
│   │   └── profiles.js
│   └── util/
│       ├── ip.js
│       └── retries.js
├── drivers/
│   ├── socket/
│   │   ├── driver.compose.json
│   │   ├── driver.js
│   │   ├── device.js
│   │   ├── driver.settings.compose.json
│   │   └── assets/
│   ├── light/
│   │   ├── driver.compose.json
│   │   ├── driver.js
│   │   ├── device.js
│   │   ├── driver.settings.compose.json
│   │   └── assets/
│   ├── fan/
│   │   ├── driver.compose.json
│   │   ├── driver.js
│   │   ├── device.js
│   │   ├── driver.settings.compose.json
│   │   └── assets/
│   ├── climate/
│   │   ├── driver.compose.json
│   │   ├── driver.js
│   │   ├── device.js
│   │   ├── driver.settings.compose.json
│   │   └── assets/
│   └── sensor/
│       ├── driver.compose.json
│       ├── driver.js
│       ├── device.js
│       ├── driver.settings.compose.json
│       └── assets/
└── package.json
```

Notes:
- Split drivers by **Homey class**, not by Tuya brand.
- Keep the Tuya protocol code centralized in `lib/tuya`.
- Use app-specific custom capabilities only where Homey system capabilities are not enough.

---

## 5) App manifest blueprint

### `/.homeycompose/app.json`

```json
{
  "id": "com.tuya.local",
  "version": "0.1.0",
  "compatibility": ">=12.0.0",
  "sdk": 3,
  "platforms": ["local"],
  "runtime": "nodejs",
  "brandColor": "#00A6A6",
  "name": {
    "en": "Tuya Direct"
  },
  "description": {
    "en": "Adds local LAN control for compatible Tuya-based devices on Homey Pro."
  },
  "category": "tools",
  "tags": {
    "en": ["tuya", "local", "lan", "wifi", "smart life"]
  },
  "images": {
    "small": "/assets/images/small.png",
    "large": "/assets/images/large.png",
    "xlarge": "/assets/images/xlarge.png"
  },
  "author": {
    "name": "<your name>",
    "email": "<your email>"
  },
  "source": "https://github.com/<your-org>/com.tuya.local",
  "homepage": "https://github.com/<your-org>/com.tuya.local",
  "support": "mailto:<your email>"
}
```

### Why this is SDK 3 compliant

- uses `sdk: 3`
- uses `platforms`
- uses Node.js runtime
- keeps a local-only positioning compatible with Homey LAN integrations

---

## 6) Discovery blueprint

### Best realistic discovery option

Use **MAC manufacturer discovery** as a helper, not as a guarantee.

Tuya devices often do **not** expose stable mDNS/SSDP service identities suitable for universal pairing, but they do often use Wi-Fi modules from vendors with identifiable MAC prefixes.

### `/.homeycompose/discovery/tuya-mac.json`

```json
{
  "type": "mac",
  "mac": {
    "manufacturer": [
      [132, 240, 88],
      [80, 232, 145]
    ]
  }
}
```

This file is only a placeholder blueprint. In practice you should verify actual MAC prefixes observed in supported hardware before publishing.

### Important warning

Do **not** rely exclusively on Homey discovery for Tuya onboarding.

Use discovery only to:
- suggest candidate IP addresses
- improve the pairing UX
- auto-update availability when possible

Still require a validation step with real Tuya socket communication.

---

## 7) Driver blueprint

## Driver classes to ship first

Start with four drivers:

1. `socket`
2. `light`
3. `fan`
4. `climate`

Add `sensor` later once you have enough reliable DP mappings.

### Example: `/drivers/socket/driver.compose.json`

```json
{
  "name": {
    "en": "Tuya Socket"
  },
  "class": "socket",
  "platforms": ["local"],
  "connectivity": "lan",
  "capabilities": [
    "onoff",
    "measure_power",
    "meter_power"
  ],
  "energy": {
    "cumulative": true
  },
  "images": {
    "small": "/drivers/socket/assets/images/small.png",
    "large": "/drivers/socket/assets/images/large.png"
  },
  "pair": [
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_devices"
      }
    },
    {
      "id": "add_devices",
      "template": "add_devices"
    }
  ],
  "repair": [
    {
      "id": "repair_credentials",
      "template": "list_devices"
    }
  ]
}
```

### Pairing note

For Tuya Direct, a custom pairing view is likely better than plain `onPairListDevices()` because you need to collect credentials and run protocol validation. The blueprint above is the **minimum compliant structure**; production implementation should likely replace the first step with a **custom pairing view**.

---

## 8) Device settings blueprint

Each driver should expose advanced settings such as:

- `host` (text)
- `device_id` (text, readonly after pair if you want)
- `local_key` (password)
- `protocol_version` (dropdown)
- `node_id` (text, optional)
- `dp_power` (number/text)
- `dp_brightness` (number/text)
- `dp_mode` (number/text)
- `poll_interval` (number)
- `use_persistent_socket` (checkbox)
- `reconnect_backoff_seconds` (number)

### Example: `/drivers/socket/driver.settings.compose.json`

```json
[
  {
    "id": "host",
    "type": "text",
    "label": { "en": "Host" },
    "hint": { "en": "IP address or hostname of the Tuya device." }
  },
  {
    "id": "device_id",
    "type": "text",
    "label": { "en": "Device ID" }
  },
  {
    "id": "local_key",
    "type": "password",
    "label": { "en": "Local Key" }
  },
  {
    "id": "protocol_version",
    "type": "dropdown",
    "label": { "en": "Protocol Version" },
    "values": [
      { "id": "auto", "label": { "en": "Auto" } },
      { "id": "3.1", "label": { "en": "3.1" } },
      { "id": "3.2", "label": { "en": "3.2" } },
      { "id": "3.3", "label": { "en": "3.3" } },
      { "id": "3.4", "label": { "en": "3.4" } },
      { "id": "3.5", "label": { "en": "3.5" } }
    ],
    "value": "auto"
  },
  {
    "id": "poll_interval",
    "type": "number",
    "label": { "en": "Poll Interval (s)" },
    "value": 30,
    "hint": { "en": "Used as a fallback when the device does not push updates reliably." }
  }
]
```

---

## 9) Pairing blueprint

## Recommended pairing flow

Use **custom pairing views**.

### Pairing stages

1. **intro**
   - Explain required fields: host, device ID, local key, protocol version.

2. **discover_or_manual**
   - Show discovered LAN candidates if any.
   - Allow manual host entry.

3. **credentials**
   - Collect `device_id`, `local_key`, optional `node_id`, protocol version.

4. **validate**
   - Attempt connection.
   - Perform:
     - heartbeat
     - status / dp query
     - protocol fallback attempt if `auto`
   - Surface DPs discovered.

5. **profile_select**
   - Infer likely class: socket / light / fan / climate / sensor.
   - Allow manual override.

6. **mapping_review**
   - Confirm or edit DP mapping.

7. **create**
   - Create Homey device with stable `data.id` based on:
     - `device_id`, or
     - `device_id:node_id` for subdevices.

## Device identity

Use Homey `data` like:

```json
{
  "id": "bf1234567890abcdef"
}
```

For a subdevice:

```json
{
  "id": "bf1234567890abcdef:sub_01"
}
```

Do **not** use IP address as `data.id`.

## Store payload

Persist mutable connection details in `store`:

```json
{
  "host": "192.168.1.25",
  "device_id": "bf1234567890abcdef",
  "protocol_version": "3.4",
  "node_id": null,
  "profile": "socket",
  "mapping": {
    "power": "1",
    "measure_power": "19",
    "meter_power": "17"
  }
}
```

Store the `local_key` in **settings** rather than `data`.

---

## 10) Mapping philosophy

This is where `localtuya` and `tuya-local` are most useful.

### What the two projects teach us

- `localtuya` is excellent for understanding **transport and session behaviour**.
- `tuya-local` is excellent for understanding **device profile mapping** from DPs to platform features.

## Recommended mapping model for Tuya Direct

Create a small internal profile system:

```js
module.exports = {
  socket_basic: {
    homeyClass: 'socket',
    capabilities: ['onoff'],
    requiredDps: ['1'],
    mapping: {
      onoff: '1'
    }
  },
  socket_energy: {
    homeyClass: 'socket',
    capabilities: ['onoff', 'measure_power', 'meter_power'],
    requiredDps: ['1'],
    optionalDps: ['17', '18', '19', '20'],
    mapping: {
      onoff: '1',
      measure_power: '19',
      measure_current: '18',
      measure_voltage: '20',
      meter_power: '17'
    },
    transforms: {
      measure_current: 'divideBy1000',
      measure_voltage: 'divideBy10',
      measure_power: 'divideBy10'
    }
  }
};
```

## Why this works well in Homey

- The Homey side remains clean and capability-oriented.
- The Tuya side remains DP-oriented.
- Per-device quirks can be isolated in profile files instead of scattered across device classes.

---

## 11) Runtime architecture

## App-level services

### `app.js`
Responsibilities:
- initialize shared logger
- create connection registry
- schedule host refresh / discovery helpers
- expose helper methods to drivers

### `lib/tuya/connection.js`
Responsibilities:
- socket lifecycle
- protocol negotiation
- heartbeat timer
- queued command exchange
- reconnect logic
- one-active-command-at-a-time discipline

### `lib/tuya/protocol.js`
Responsibilities:
- command IDs
- payload framing / parsing
- 3.1 / 3.3 / 3.4+ handling
- encode/decode helpers

### `lib/tuya/mapper.js`
Responsibilities:
- infer Homey profile from discovered DPs
- convert DP payloads to Homey capability values
- convert Homey capability updates to DP writes

---

## 12) Device class runtime blueprint

### `/drivers/socket/device.js`

```js
'use strict';

const Homey = require('homey');
const TuyaConnection = require('../../lib/tuya/connection');
const { dpToCapability, capabilityToDp } = require('../../lib/tuya/mapper');

class TuyaSocketDevice extends Homey.Device {
  async onInit() {
    this.connection = new TuyaConnection({
      host: this.getSetting('host'),
      deviceId: this.getSetting('device_id'),
      localKey: this.getSetting('local_key'),
      protocolVersion: this.getSetting('protocol_version'),
      nodeId: this.getSetting('node_id') || null,
      homey: this.homey,
      log: this.log.bind(this),
      error: this.error.bind(this)
    });

    this.registerCapabilityListener('onoff', async value => {
      const command = capabilityToDp(this, 'onoff', value);
      await this.connection.setDps(command);
    });

    this.connection.on('connected', async () => {
      await this.setAvailable();
      const dps = await this.connection.status();
      await this._applyDps(dps);
    });

    this.connection.on('disconnected', async err => {
      await this.setUnavailable(err?.message || 'Disconnected from Tuya device');
    });

    this.connection.on('dps', async dps => {
      await this._applyDps(dps);
    });

    await this.connection.connect();
  }

  async _applyDps(dps) {
    const updates = dpToCapability(this, dps);

    for (const [capabilityId, value] of Object.entries(updates)) {
      if (this.hasCapability(capabilityId)) {
        await this.setCapabilityValue(capabilityId, value);
      }
    }
  }

  async onSettings({ changedKeys, newSettings }) {
    if (changedKeys.some(key => [
      'host',
      'local_key',
      'protocol_version',
      'poll_interval'
    ].includes(key))) {
      await this.connection.reconnect({
        host: newSettings.host,
        localKey: newSettings.local_key,
        protocolVersion: newSettings.protocol_version
      });
    }
  }

  async onDeleted() {
    if (this.connection) {
      await this.connection.destroy();
    }
  }
}

module.exports = TuyaSocketDevice;
```

This is a blueprint only, but it follows the normal Homey SDK 3 device lifecycle.

---

## 13) Command flow blueprint

## Read state

1. connect
2. negotiate session if needed
3. send heartbeat
4. send DP query
5. update Homey capabilities
6. subscribe to socket messages / periodic refresh fallback

## Write state

1. Homey capability listener fires
2. map capability → one or more DP writes
3. send `CONTROL` / `CONTROL_NEW`
4. wait for ack or refreshed state
5. update cache

## Refresh strategy

Recommended:
- persistent connection with heartbeat
- if no updates arrive, run fallback poll every `poll_interval`
- if device becomes busy/unreachable, exponential reconnect

---

## 14) Compliance and UX rules

## Homey SDK 3 compliance checklist

- SDK version `3`
- `platforms` set on app and drivers
- `connectivity: "lan"` on drivers
- pairing defined in driver manifest
- unique immutable `data.id`
- mutable data in `store` / `settings`
- capabilities match Homey class
- custom capabilities only when necessary
- device settings exposed through `driver.settings.compose.json`
- device availability updated properly

## Store sensitive values carefully

- `local_key` should not be in `data`
- keep it in settings or encrypted app-managed storage if you later add your own secure layer

## App Store wording to avoid

Avoid claims like:
- “works with all Tuya devices”
- “fully offline”
- “automatic setup for every device”

Prefer:
- “compatible with supported Tuya-based Wi-Fi devices”
- “local LAN control for supported devices”
- “manual setup may be required”

---

## 15) What to build first

## Milestone 1 — MVP

- socket driver
- light driver
- manual pairing only
- protocol versions `3.3` and `3.4`
- DP query + control
- persistent connection
- fallback poll

## Milestone 2

- fan driver
- climate driver
- DP auto-profile suggestions
- repair flow for new IP / new local key

## Milestone 3

- MAC-assisted discovery
- energy transforms
- subdevice / hub support
- profile library derived from known working devices

---

## 16) Recommended source interpretation

### From `rospogrigio/localtuya`
Borrow the ideas for:
- transport handling
- `UPDATEDPS`
- DP discovery
- session negotiation for `3.4`
- robust reconnection behaviour

### From `make-all/tuya-local`
Borrow the ideas for:
- device profile structure
- manual and assisted configuration
- explicit protocol override
- handling hub/node subdevices
- practical warnings about single-client local connections

### From `tinytuya`
Borrow the ideas for:
- command framing
- protocol constants
- command names
- supported version spread
- general Tuya payload semantics

Do **not** blindly copy code into a Homey app without reviewing licenses and refactoring for Homey's runtime model.

---

## 17) Final recommendation

The strongest architecture for **Tuya Direct** is:

- **Homey-native device drivers and capabilities**
- one shared **Tuya LAN transport layer**
- a **profile mapper** inspired by `tuya-local`
- a **manual-first pairing flow** with optional discovery hints
- explicit support for **single local connection limits** and **protocol version overrides**

That gives you a realistic first release that is technically aligned with how local Tuya devices actually behave, and it stays compliant with Homey SDK 3 patterns.

---

## 18) Minimal starter snippets to implement next

### `app.js`

```js
'use strict';

const Homey = require('homey');

class TuyaDirectApp extends Homey.App {
  async onInit() {
    this.log('Tuya Direct has been initialized');
    this.connectionRegistry = new Map();
  }
}

module.exports = TuyaDirectApp;
```

### `package.json`

```json
{
  "name": "com.tuya.local",
  "version": "0.1.0",
  "private": true,
  "main": "app.js",
  "engines": {
    "node": ">=22"
  }
}
```

### Pairing return object example

```js
{
  name: 'Kitchen Plug',
  data: {
    id: 'bf1234567890abcdef'
  },
  settings: {
    host: '192.168.1.25',
    device_id: 'bf1234567890abcdef',
    local_key: '0123456789abcdef',
    protocol_version: '3.3'
  },
  store: {
    profile: 'socket_energy',
    mapping: {
      onoff: '1',
      measure_power: '19',
      meter_power: '17'
    }
  }
}
```

---

## 19) Suggested next implementation step

Implement only this vertical slice first:

- socket driver
- manual credentials pairing
- connect
- `status()`
- `set onoff`
- map DP `1` → `onoff`
- mark unavailable on disconnect
- reconnect with backoff

Once that is stable, expand into lights and energy metering.
