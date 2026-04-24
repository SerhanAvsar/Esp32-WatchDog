# ESP32-Security V2: Tam Kurulum ve Donanım Kılavuzu

Bu belge, sistemi **sıfırdan alıp tamamen çalışır bir noktaya getirebilmeniz için** yazılmış en güvenli ve hatasız kurulum rehberidir. Lütfen aşağıdaki 5 aşamayı **başka hiçbir işlem yapmadan, metinde yazdığı sırayla** uygulayın.

---

## Aşama 1: Ağ ve IP Ayarlarının Hazırlanması (En Kritik Adım)

Sisteminizin kalbi olan Node.js sunucusu ile ESP32'nin birbirini bulabilmesi için adresleme yapmalısınız. Lütfen hangi ağı (İnterneti) kullanacaksanız o yönergeyi uygulayın:

### Seçenek A: Ev İnterneti / Standart Modem Kullanımı (Önerilen)
1. Bilgisayarınızın ve ESP32'nin aynı modeme bağlı olacağından emin olun. Bilgisayarınızda (başlat menüsü) `cmd` yazarak Komut İstemcisini açın.
2. Siyah ekrana `ipconfig` yazıp Enter'a basın.
3. Çıkan listede ağınıza ait **IPv4 Address** satırını bulun (Örn: `192.168.1.45`). Bu sayıyı kopyalayın.
4. Projenizdeki `ESP32CAM/CameraWebServer/CameraWebServer.ino` dosyasını Arduino IDE ile açın.
5. **Satır 12-13:** Evinizdeki modemin Wi-Fi adını (`ssid`) ve Şifresini (`password`) girin.
6. **Satır 142 ve 165 civarı:** Dosyanın aşağılarındaki iki ayrı HTTP bağlantı kodunda göreceğiniz `http://192.168.1.X:3000...` kısımlarındaki IP bölümünü SİLİP kendi aldığınız IPv4 adresini yazın ve kaydedin.

### Seçenek B: Telefondan Mobil Veri (Hotspot) Kullanımı
*DİKKAT: Telefonunuz her Hotspot açıldığında bilgisayarınıza rastgele YENİ bir IP (Örn: 192.168.43.60) atar. Yani her aç kapa yaptığınızda ESP32'ye yeni IP'yi Öğretmek (yeniden kod yüklemek) zorunda kalabilirsiniz.*
*ÖNEMLİ: İphone (Apple) cihazlarda donanımsal güvenlik kalkanı (Client Isolation) bulunduğu için iki cihazın aynı Hotspot'ta birbirine veri yollaması genellikle engellenir. Bu sistem Android hotspot'ları ile güvenle çalışır.*
1. Telefonunuzun internet paylaşımını (Hotspot) açın ve bilgisayarınızın Wi-Fi'sini bu ağa bağlayın.
2. Bilgisayarınız **kesinlikle telefonunuza bağlıyken** `cmd` açıp `ipconfig` yazın.
3. Gelen listedeki yepyeni **IPv4 Address** numarasını kopyalayın.
4. `CameraWebServer.ino` dosyasını açın.
5. **Satır 12-13:** Wi-Fi adına Telefonunuzun Hotspot Adını, Şifresine ise telefon Hotspot şifresini girin. (Türkçe harf olmamalıdır).
6. **Satır 142 ve 165 civarı:** Dosyadaki IP kısımlarına o an telefonunuzun tayin ettiği o yepyeni "IPv4 adresini" yazın ve kaydedin.

---

## Aşama 2: Kodu ESP32-CAM'e Yüklemek (Arduino'yu Sadece Kablo Olarak Kullanma Modu)

*DİKKAT: Bu aşama sadece koda ESP32'yi öğretmek içindir. İşlem bitince kurduğumuz bu "Upload" devresini tamamen bozacaksınız.*

1. Arduino ve ESP32'nin tüm kablolarını sökün. İkisi de tamamen boş kalsın.
2. **(Zorunlu Bypass)** Arduino üzerindeki **RESET** pinini yine Arduino üzerindeki bir **GND** pinine jumper kablosuyla direkt bağlayın. *(Bu hareket, Arduino beynini geçici kapatır).*
3. ESP32-CAM ile Arduino'yu **Yalnızca Yükleme Yapmak İçin** şöyle bağlayın:
   - Arduino **5V** ➔ ESP32 **5V**
   - Arduino **GND** ➔ ESP32 **GND**
   - Arduino **RX (Pin 0)** ➔ ESP32 **UOT (veya UOTD / TX)** *(Yükleme modunda RX-RX'e çapraz bağlanmaz. Düz bağlanır!)*
   - Arduino **TX (Pin 1)** ➔ ESP32 **UOR (veya UORD / RX)** 
4. **(Flash Kilidini Açma)** ESP32 üzerindeki **IO0 (GPIO 0)** pinini kendi **GND** pinine bağlayın.
5. Arduino'yu USB üzerinden bilgisayara takın. Arduino IDE'den "_ESP32 Wrover Module_" veya "_AI Thinker ESP32-CAM_" seçip, portunuzu seçin ve **Yükle** butonuna basın.
6. "Connecting..." yazısında kalırsa ESP32 arkasındaki küçük RST tuşuna bir anlık basın.
7. Ekranda **Done Uploading** yazdığı an sistem kodu aldı demektir. USB kablosunu bilgisayardan ÇEKİN.
8. **ÖNEMLİ:** Kurduğunuz bu aşamadaki BÜTÜN KABLOLARI SÖKÜP ÇÖPE ATMIŞ GİBİ SİSTEMLERİ BİRBİRİNDEN AYIRIN. O kablolar sadece yükleme içindi!

---

## Aşama 3: Kodu Sensör Ustası Olan Arduino'ya Yüklemek

1. Bütün kablolardan arındırılmış, bomboş duran Arduino'nuzu USB üzerinden yalnız başına bilgisayara geri takın.
2. Arduino IDE'yi açıp `Arduino_Sensor/Arduino_Sensor.ino` dosyasını açın.
3. Kart kısmından "Arduino Uno"nuzu seçip (COM Port onaylayarak) **Yükle** deyin.
4. "Done Uploading" yazısını görünce bilgisayardan çekin. Her iki kartın da beyni şu an görevlerine hazır.

---

## Aşama 4: NIHAI ve KALICI SİSTEM BAĞLANTISI (Doğru Sensör Bağlantıları)

Sistemlerin çalışması için onlara USB şarj cihazıyla veya ortak kanaldan güç verdiğinizi (5V elektrik aldıklarını) varsayarak ana üretim devresini kuruyoruz:

### Sensörlerin Arduino'ya Bağlanması:
1. **HC-SR04 Uzaklık Sensörü:**
   - VCC ➔ Arduino **5V**
   - GND ➔ Arduino **GND**
   - Trig ➔ Arduino **9. Pin**
   - Echo ➔ Arduino **10. Pin**
2. **MQ-2 Gaz ve Duman Sensörü:**
   - VCC ➔ Arduino **5V** *(Uzaklık sensörünün bağlandığı 5V girişine çoklayabilirsiniz)*
   - GND ➔ Arduino **GND**
   - A0 (Analog Çıkış) ➔ Arduino **A0** 
   - D0 (Dijital Çıkış) ➔ ***ASLA BAĞLAMAYIN, BOŞ BIRAKIN.***

### İki Kartın Birbiriyle Haberleşmesi (Can Damarı):
Sensör bilgisinin ESP32'den panele gidebilmesi için iki kartın bir diyalog kurması lazımdır.
- Arduino **3. Pin (TX)** ➔ ESP32 **RX (UOR / UORD)** _(Sinyal çakışmasını engellemek için yeni Arduino yazılımında 3 numaralı pin iletişim teli yapılmıştır.)_
- Arduino **GND** ➔ ESP32 **GND** _(Ayrıca topraklama hattından birbirlerini tanımaları şarttır. İki kart arasından bir GND teli çekilmek zorundadır.)_
_*(Uyarı: Çalışma anında ESP32'nin TX pinine veya Arduino'nun RX pinine hiçbir şey BAĞLANMAZ. Yukarıdaki ikisini yapmanız yeterlidir).*_

---

## Aşama 5: Node.js Panelini "Doğru" Şekilde Çalıştırma (Kayıtların Düşmesini Sağlayan Adım)

Verilerin panelinize (dashboard'a) düşmemesinin en yaygın sebebi .HTML dosyalarına fareyle çift tıklanarak girilmesidir. Sistem böyle çalışmaz.

1. Eğer açıksa Chrome'da o HTML sayfalarını dahil her şeyi tamamen kapatın.
2. Masasütünüzdeki projenizin yani klasörünüzün `web_panel` kısımlarına gidin.
3. Dosya dizininde göreceğiniz **`start_server.bat`** yazan dosyaya çift tıklayın. Siyah bir CMD ekranı açılacaktır. 
4. O ekranda `Connected to the SQLite database` ve `Server running at http://...` benzeri uyarıları okuyacaksınız. **Ve o siyah ekranı ASLA kapatmayacaksınız (aşağı alabilirsiniz).** O siyah ekran kapalıyken sensörden veri gelmesi veya panele girmek imkansızdır.
5. Tarayıcınızı (Google Chrome vb.) açıp URL çubuğuna şunu yazın: `http://localhost:3000` (Emniyet için IPv4 adresinizin adını yazarak; `http://192.168.1.45:3000` de diyebilirsiniz).
6. Ana sayfaya ulaşacaksınız, "123" şifreleriyle Login olun. "Giriş Kayıtları" sayfasına gelin.
7. Sensöre el kaldırın... Siyah Node.js ekranında "[BAŞARILI] Mesafe eklendi" yazacak ve yepyeni panellere şak diye veriler düşecek! 

*(İleride farklı odalardan sensörleri görmek isterseniz tek yapacağınız evdeki telefon veya tabletinizin Google tarayıcısına o güncel IPv4 adresinizi (Örn: `http://192.168.1.45:3000`) yazmak olacaktır.)* Aksi halde telefonunuzdan panele giremezsiniz çünkü localhost o an kullanılan bilgisayarı temsil eder.




Esp32nin txi arduinonun 2.pini
Esp32nin rxi arduinoun 3.pini