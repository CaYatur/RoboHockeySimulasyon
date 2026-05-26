# ROBOHOKEY Simülasyon (DualSense ile 2v2 antrenman)

Fiziksel pist/robot olmadan, PC'de DualSense (PS5 kumandası) ile ROBOHOKEY
antrenmanı yapmak için web tabanlı simülasyon. Kontroller gerçek robot koduyla
(`RoboHockeyCarCodeDualsense.ino`) **birebir aynıdır**, böylece burada öğrendiğin
sürüş gerçek robota da taşınır.

## Çalıştırma

İki yol var, ikisi de yeterli:

**1) En kolay:** `index.html` dosyasına çift tıkla → tarayıcıda açılır.

**2) Node ile (önerilir, Gamepad API daha kararlı):**
```
cd RoboHockeySimulasyon
npm start
```
Sonra tarayıcıdan **http://localhost:3000** adresini aç.

> Chrome veya Edge öner. Kumanda görünmüyorsa, USB/Bluetooth ile bağladıktan
> sonra **bir tuşa bas** (tarayıcı güvenliği gereği ilk girişte kumandayı
> uyandırmak gerekir).

## Kontroller (.ino ile aynı)

| Giriş | İşlev |
|---|---|
| **R2** | İleri gaz |
| **L2** | Geri / fren |
| **Sol çubuk (X)** | Direksiyon (yerinde dönüş) |
| **○ (Circle)** | TURBO (hız limitini aşar) |
| **D-pad ↑ / ↓** | Varsayılan hız limiti ayarı |
| **OPTIONS** | Başlat / Duraklat |

Klavye yedeği: `↑/W` gaz, `↓/S` geri, `←→ / A D` direksiyon, `Shift` turbo,
`[ ]` hız limiti, `Boşluk` başlat/duraklat.

## Maç düzeni

- **2 takım, her takımda 2 robot** (sahada 4 robot).
- **Mavi #1 = sen**, diğer 3 robot bottur (bir takım arkadaşın + 2 rakip).
- Botlar diske en yakın olanı hücuma, diğeri savunmaya geçecek şekilde davranır.

## Kurallara uygun ölçüler

- Saha **240 × 160 cm**, çevresi duvar.
- Kale **40 cm** genişlik, sahanın kısa kenarlarının ortasında.
- Disk çapı **110 mm**.
- Robot **20 × 20 cm**.
- Maç **2 devre × 2 dk**; devre arasında kale değişimi.
- Disk **10 sn** hareketsiz kalırsa orta sahadan tekrar başlar.
- Golden sonra robotlar kendi kaleleri önüne dizilir, orta vuruşla devam.

## Notlar / sonraki adımlar

- Bu sürüm "kavrama" mekanizmasını modellemez; robot diski yalnızca **iter**
  (kurallarda kavrama/kafesleme zaten yasak — 40 mm sınırı).
- İleride eklenebilir: sarı/kırmızı kart simülasyonu, ikinci oyuncu için ikinci
  kumanda, haptik geri bildirim (Gamepad `vibrationActuator`).

## Teknolojiler

HTML5 Canvas, düz JavaScript (Gamepad API), Node.js (yalnızca basit statik dosya sunucusu, bağımlılık yok).

## Proje yapısı

```
index.html   Arayüz (saha, skor, kumanda durumu)
sim.js       Fizik, botlar, kontroller ve maç kuralları
style.css    Stil
server.js    Basit statik sunucu (PORT, varsayılan 3000)
```

## İlgili proje

Gerçek robotun kodu ve Android/DualSense kumandası: [CaYatur/RoboCar](https://github.com/CaYatur/RoboCar) (ESP32 robot araç).

## Bilinen sorunlar

- Robotlar diski yalnızca iter, kavrama modellenmez.
- Tek oyuncu (tek kumanda) desteklenir; diğer 3 robot bottur.
- Kod, sahayı dikey (160 × 240 cm, kaleler üstte ve altta) çizer.

## Proje tarihleri

- Oluşturma: 27 Mayıs 2026
- Son güncelleme: 27 Mayıs 2026

## Lisans

Lisans dosyası yoktur (`package.json` içinde "MIT" yazmaktadır).

---

# 🇬🇧 English

**RoboHockey Simulation** is a web-based 2v2 robot hockey training simulator played with a **DualSense (PS5) controller**. Controls mirror the real robot firmware (`RoboHockeyCarCodeDualsense.ino`), so driving practice transfers to the physical robot. Related hardware project: [CaYatur/RoboCar](https://github.com/CaYatur/RoboCar).

### Run
Open `index.html` directly, or `npm start` and browse to http://localhost:3000 (Chrome/Edge recommended; press a button on the controller to wake it).

### Controls
| Input | Action |
|---|---|
| R2 | Throttle |
| L2 | Reverse / brake |
| Left stick X | Steering (spin in place) |
| ○ Circle | Turbo |
| D-pad ↑/↓ | Speed limit |
| OPTIONS | Start / pause |

Keyboard fallback: `↑/W`, `↓/S`, `←→/A D`, `Shift` turbo, `[ ]` speed limit, `Space` start/pause.

### Match rules
2 teams × 2 robots (you are Blue #1, the other 3 are bots: one attacks the puck, one defends). Field 160 × 240 cm with walls, 40 cm goals, 110 mm puck, 20 × 20 cm robots, 2 halves × 2 min with side switch, puck reset after 10 s idle.

### Tech
HTML5 Canvas, vanilla JavaScript (Gamepad API), Node.js static server (no dependencies).

### Known issues
Robots only push the puck (no gripping); single human player only.

### Project dates
- Created: 27 May 2026
- Last updated: 27 May 2026

### License
No license file (`package.json` declares "MIT").
