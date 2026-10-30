# HARDWARE STATUS: Physical Prototype Audit, Firmware Review & Field Validation Roadmap

**Project:** HIVEGUARD  
**Document:** Hardware Architecture, Firmware Audit & Physical Deployment Status  
**Date:** October 30, 2026  
**Hardware Platform:** Espressif ESP32 NodeMCU Development Board  

---

## 1. Prototype Hardware Specification

The physical bench prototype consists of the following components:

| Component | Interface / Pins | Nominal Range / Specification | Role in Prototype |
| :--- | :--- | :--- | :--- |
| **ESP32 DevKit V1** | Micro-USB / 3.3V | Dual-Core Tensilica Xtensa 32-bit LX6 @ 240 MHz | Core micro-controller & telemetry edge node |
| **DHT22 (AM2302)** | GPIO 4 (1-Wire digital) | $T: -40^\circ\text{C} \text{ to } +80^\circ\text{C}$ ($\pm 0.5^\circ\text{C}$); $H: 0\% \text{ to } 100\%$ ($\pm 2\%$) | Internal hive temperature and relative humidity |
| **HX711 ADC & Load Cell** | GPIO 16 (SCK), 17 (DT) | 24-bit ADC with 4-wire Wheatstone bridge strain gauge (50 kg) | Continuous colony biomass & honey store tracking |
| **I2C LCD 16x2** | GPIO 21 (SDA), 22 (SCL) | PCF8574 backpack (I2C address `0x27`) | On-site beekeeper visual status readout |
| **Piezo Buzzer** | GPIO 26 (PWM/Tone) | 85 dB @ 10 cm, resonant freq 2.4 kHz | Audible local alarm for acute colony emergencies |
| **Status LED** | GPIO 25 (Digital Out) | Ultra-bright red LED (with 220 $\Omega$ current resistor) | Visual local alarm indicator |

---

## 2. Firmware Audit: Laboratory Prototype Sketch

The bench demonstration firmware (provided in the project repository) implements local threshold logic:

```cpp
#include <Wire.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>

#define DHTPIN 4
#define DHTTYPE DHT22
#define LED_PIN 25
#define BUZZER_PIN 26

LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

float tempThreshold = 30.0;
float humThreshold = 50.0;
float weightThreshold = 12.4;

void setup() {
  Serial.begin(115200);
  dht.begin();
  lcd.init();
  lcd.backlight();
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  lcd.setCursor(0,0);
  lcd.print("HIVEGUARD");
  lcd.setCursor(0,1);
  lcd.print("Starting...");
  delay(2000);
  lcd.clear();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  float weight = 12.5; // Bench placeholder
  if (isnan(t) || isnan(h)) {
    Serial.println("DHT Error!");
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Sensor Error");
    delay(2000);
    return;
  }
  bool anomaly = false;
  if (t >= tempThreshold) anomaly = true;
  if (h >= humThreshold) anomaly = true;
  if (weight < weightThreshold) anomaly = true;

  if (anomaly) {
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 1000);
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("ALERT!");
    lcd.setCursor(0,1);
    lcd.print("CHECK HIVE");
  } else {
    digitalWrite(LED_PIN, LOW);
    noTone(BUZZER_PIN); // Firmware correction: replace tone with noTone
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("T:"); lcd.print(t,1); lcd.print(" H:"); lcd.print(h,0);
    lcd.setCursor(0,1);
    lcd.print("W:"); lcd.print(weight,1); lcd.print("kg");
  }
  delay(3000);
}
```

### Audited Code Defects in Laboratory Sketch:
1. **Buzzer Bug in Original Code:** In the initial sketch, `tone(BUZZER_PIN, 1000)` was called in both the `if (anomaly)` and `else` blocks, causing the buzzer to sound continuously regardless of hive state. The `else` block must call `noTone(BUZZER_PIN)`.
2. **Fixed Biomass Weight:** `float weight = 12.5;` is hardcoded on the bench rather than reading calibrated counts from the HX711 library (`scale.get_units(10)`).
3. **Static Thresholds:** The firmware enforces rigid invariant thresholds ($T \ge 30.0^\circ\text{C}$, $H \ge 50.0\%$), reproducing the exact failure mode of **Method A** identified in our scientific audit.
4. **Blocking Delays:** `delay(3000)` blocks execution, preventing asynchronous Wi-Fi/MQTT packet transmission and FreeRTOS task scheduling.

---

## 3. Physical Validation Status & Limitations

### 3.1 What Has Been Validated
- Sensor communication over I2C and 1-Wire bus on the ESP32.
- Serial UART telemetry streaming to a host computer.
- LCD 16x2 visual formatting and LED/buzzer alert triggering under simulated heat source (hairdryer / warm breath).

### 3.2 What Has NOT Been Validated (Critical Scientific Disclosure)
- **NO LIVE HONEYBEE COLONY VALIDATION:** Due to seasonal active-period constraints and apiary distance, **no live honeybee colony (*Apis cerana indica* or *Apis mellifera*) has yet been monitored with this physical ESP32 prototype**.
- **Environmental Enclosure Durability:** The prototype has not been enclosed in a weatherproof, propolis-resistant NEMA-4X enclosure. Inside a hive, honeybees coat foreign objects with propolis (bee glue), which can coat DHT22 mesh openings and impede humidity diffusion.
- **Power Budget & Solar Autonomy:** The prototype has not been tested with a solar power management system (e.g. 18650 Li-ion battery + TP4056 + 5V boost regulator + solar panel). In field conditions, power consumption without deep-sleep modes will drain a 2500 mAh battery within ~36 hours.

---

## 4. Edge Firmware Upgrade Roadmap (Method C on ESP32)

To deploy the research framework onto the physical ESP32, the following technical upgrades are specified for the upcoming active field season:

```
[ ESP32 FreeRTOS Task Architecture ]
 Task 1: Sensor Sampling (every 15 min, wakes from deep sleep)
   ├── Read DHT22 (Temp & Humidity)
   ├── Read HX711 (Calibrated Scale Weight)
   └── Read VBAT (Battery Health Voltage)
           │
           ▼
 Task 2: Edge Data-Quality & Reliability Filter (src/research/sensor_reliability)
   ├── Circular Buffer (size = 12 steps)
   ├── Stuck Sensor Check (Variance < 1e-4)
   └── Impulse Spike Filter (|x_t - x_{local}| / MAD)
           │
           ▼
 Task 3: Lightweight Diurnal Baseline & Persistence Gating
   ├── 24-Hour Diurnal Lookup Array (24 float medians stored in Flash/NVS)
   ├── Robust Standardization: Z_t = (x_t - med) / (1.4826 * MAD)
   └── Persistence Counter: k_active >= 4 steps -> Trigger Alert
           │
           ▼
 Task 4: Telemetry Dispatch & Sleep
   ├── Send JSON telemetry via MQTT / HTTPS to https://hiveguard.onrender.com/
   └── Enter ESP32 Deep Sleep (15 minutes, consumption < 15 uA)
```

This architecture ports Method C directly to edge micro-controllers, ensuring low power consumption, resilient local anomaly detection, and zero false alarms from transient bus glitches.
