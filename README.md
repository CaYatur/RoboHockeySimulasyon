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
