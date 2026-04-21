# Esp32-Security & HC-SR04 Uzaklık Sensörü Entegrasyon Kılavuzu

Bu belge, FTDI (Programlayıcı) modülü olmayan kullanıcıların, mevcutta bulunan Arduino kartlarını bir dönüştürücü gibi kullanarak **ESP32-CAM** ve **Arduino** cihazlarına nasıl kod yükleyeceğini ve sistemi donanımsal olarak nasıl birleştireceğini anlatır. Lütfen adımları atlamadan sırayla uygulayın.

---

## Aşama 1: ESP32 Kodunu Bilgisayarınıza (IP'nize) Göre Ayarlama
Bu adımı kodu karta yüklemeden **önce** yapmalısınız:

1. Bilgisayarınızın arama (Start) menüsüne `cmd` yazıp açın ve siyah ekrana `ipconfig` yazarak enter'a basın.
2. Çıkan listede **IPv4 Address** yazan değer (Örn: `192.168.1.45`) sizin yerel IP adresinizdir. Bunu kopyalayın.
3. Proje dizinindeki `ESP32CAM/CameraWebServer/CameraWebServer.ino` dosyasını açın.
4. Alt satırlarda bulunan `http.begin("http://192.168.1.X:3000/api/sensor");` bölümündeki `192.168.1.X` kısmını kopyaladığınız kendi IPv4 adresiniz ile değiştirip dosyayı kaydedin.
5. Aynı dosyada 12. ve 13. satırlarda bulunan Wi-Fi adını (`ssid`) ve Şifreyi (`password`) kendi modeminizin bilgileriyle güncellemeyi unutmayın!

---

## Aşama 2: Arduino Üzerinden ESP32-CAM'e Kod Yükleme (FTDI Olmadan)
Şimdi o kodu bilgisayardan çıkartıp doğrudan ESP32-CAM'in içine göndereceğiz:

1. Arduino'nun USB kablosunu bilgisayarınızdan çıkartın ve Arduino boşta dursun.
2. **(Atlanmamalı)** Arduino kartınızdaki **RESET** pinini yine Arduino üzerindeki bir **GND (Toprak)** pinine bir jumper kablosuyla bağlayın. (Bu sayede Arduino geçici olarak kendi işlemcisini uyutup beyinsiz bir kabloya dönüşecek).
3. ESP32-CAM ile Arduino'yu birbirine şu şekilde bağlayın:
   - Arduino **5V** ➔ ESP32 **5V**
   - Arduino **GND** ➔ ESP32 **GND**
   - Arduino **RX (Pin 0)** ➔ ESP32 **UOT (veya UORD / RX)**
   - Arduino **TX (Pin 1)** ➔ ESP32 **UOR (veya UOTD / TX)**
4. **(Yükleme Modu Kilidi)**: ESP32'nin kod hafızasını kırmak için, ESP32 üzerindeki **IO0 (GPIO 0)** pinini kendi **GND** pinine bağlayın.
5. Arduino'yu USB üzerinden bilgisayara takın.
6. Arduino IDE içerisinden _ESP32 Wrover Module_ veya _AI Thinker ESP32-CAM_ modelini ve bilgisayarınızdaki bağlı COM Portunu seçin.
7. "Yükle (Upload)" butonuna basın. (*Siyah ekranda yükleme esnasında "Connecting..." yazısında çok uzun süre kalırsa, ESP32'nin arkasındaki ufak RST/Reset butonuna 1 saniye basılı tutmanız gerekebilir*).
8. Yükleme tamamen bittiğinde ("Done Uploading"), Arduino'nun USB kablosunu bilgisayardan **ÇEKİN**.
9. Hem **IO0 ➔ GND** kablosunu hem de Arduino üzerindeki **RESET ➔ GND** bypass kablosunu **MUTLAKA ÇIKARTIN.**

---

## Aşama 3: Sensör (HC-SR04 ve MQ-2) Kodunu Arduino'ya Yükleme
1. Arduino şu an tamamen kablolardan arındırılmış ve tek başına boş olmalı.
2. Arduino'nuzu USB'den bilgisayarınıza geri takın.
3. Bu kez Arduino IDE üzerinden `Arduino_Sensor/Arduino_Sensor.ino` dosyasını açın.
4. Kart olarak menüden (Araçlar) kendi "Arduino Uno (veya Nano)"nuzu seçin ve "Yükle (Upload)" diyin.
5. Yükleme bitince Arduino'yu bilgisayardan çekebilirsiniz. İki kartın da beyni şu an hazır.

---

## Aşama 4: Sistemi Fiziksel Olarak Birleştirme (Kalıcı Donanım Kurulumu)
İki cihaza da ayrı ayrı (adaptör veya telefon şarjı üzerinden ikili USB ile) enerji verdikten veya ortak bir 5V kanalından bağladıktan sonra son iletişimi kuralım:

1. **Sensörleri Arduino'ya takın:**
   - **HC-SR04 (Uzaklık Sensörü):**
     - VCC ➔ Arduino 5V
     - GND ➔ Arduino GND
     - Trig ➔ Arduino 9. Pin
     - Echo ➔ Arduino 10. Pin
   - **MQ-2 (Gaz/Duman Sensörü):**
     - VCC ➔ Arduino 5V (HC-SR04 sensörünüzle aynı porta breadboard ile veya kabloları birleştirerek takabilirsiniz)
     - GND ➔ Arduino GND
     - A0 / Analog Out ➔ Arduino A0 Pini

2. **Kartları Birbiriyle Haberleştirin:** 
   - **Arduino TX (Pin 1)** ➔ **ESP32 RX (UOT/UORD)** _(Arduino sürekli konuşur, ESP32 bunu kulaklıktan dinler)_
   - **Arduino GND** ➔ **ESP32 GND** _(Elektriksel sinyal kirliliğini (gürültü) önlemek ve iki cihazı aynı referansa sokmak için toprak pinleri ortaklanmalıdır)_

---

## Aşama 5: Node.js Panelini Çalıştırma ve Test
1. Masaüstünüzdeki `Esp32-Security\web_panel` klasörüne gidip `start_server.bat` dosyasına tıklayarak Node.js sunucusunu ayağa kaldırın. (Alternatif olarak o dizinde komut satırını açıp `node server.js` yazabilirsiniz).
2. Konsol ekranında `Server running at http://localhost:3000` veya _Connected to SQLite_ ibarelerini gördüğünüz emin olun.
3. Sistemlere elektriği verin.
4. Tarayıcınızdan `http://localhost:3000` adresine girip Giriş Kayıtları sekmesine gelin.
5. HC-SR04 sensörünün karşısına (10cm - 1 metre arasına) elinizi koyduğunuzda veya MQ-2 sensörüne bir çakmak gazı/duman tuttuğunuzda; anlık veriler panelinizdeki ekrana tablo olarak düşecektir!

_Karşılaştığınız herhangi bir sorunda Node.js konsolundaki çıktıları veya Arduino IDE'deki Seri Monitör dökümlerini kontrol etmeyi unutmayın._
