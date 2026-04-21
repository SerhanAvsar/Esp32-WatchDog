#include <SoftwareSerial.h>

// ESP32 İle İletişim İçin Yeni Çizgi (SoftwareSerial)
// RX = Pin 2, TX = Pin 3
// ARDUINO'nun 3. Pini (TX) -> ESP32'nin RX (U0R) pinine bağlanacak!
SoftwareSerial espSerial(2, 3);

// HC-SR04 Sensör Pin Tanımlamaları
const int trigPin = 9;
const int echoPin = 10;

// MQ-2 Sensör Pin ve Eşik Değeri
const int mq2Pin = A0;
const int gasThreshold = 400; // Bu değeri ortamınıza göre ayarlayabilirsiniz

// Değişkenler
long duration;
float distance;
unsigned long lastSendTime = 0;
const int sendInterval = 2000; // 2 saniye cooldown

void setup() {
  Serial.begin(115200);     // Sizin bilgisayardan görmeniz için bağlanan USB seri port
  espSerial.begin(115200);  // ESP32'ye giden yeni güvenli hat
  
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  
  // A0 varsayılan olarak analog giriştir, pinMode yazmaya gerek yoktur 
  Serial.println("Sistem Baslatildi. Sensorler dinleniyor...");
}

void loop() {
  // HC-SR04 Tetikleme
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  // Echo pininden dönen dalganın süresini oku
  duration = pulseIn(echoPin, HIGH);
  
  // Süreyi mesafeye çevir (cm cinsinden)
  // Ses hızı yaklaşık 0.034 cm/mikrosaniye
  distance = duration * 0.034 / 2;
  
  // Mesafe 10cm ile 1m (100cm) arasında mı kontrol et
  if (distance >= 10.0 && distance <= 100.0) {
    // Spam gönderimi engellemek için cooldown kontrolü
    if (millis() - lastSendTime > sendInterval) {
      lastSendTime = millis();
      
      // Bilgisayardan Görme (Log)
      Serial.print("Mesafe Algilandi: ");
      Serial.println(distance);

      // ESP32'ye veriyi gönder (GERÇEK HAT)
      // Format: DISTANCE:45.50
      espSerial.print("DISTANCE:");
      espSerial.println(distance);
    }
  }

  // === MQ-2 GAZ SENSÖRÜ KONTROLÜ ===
  int gasValue = analogRead(mq2Pin);
  
  // Okunan değer eşik değerinden büyükse tehlike var demektir
  if (gasValue > gasThreshold) {
    if (millis() - lastSendTime > sendInterval) {
      lastSendTime = millis();

      // Bilgisayardan Görme (Log)
      Serial.print("Gaz/Duman Algilandi! Seviye: ");
      Serial.println(gasValue);
      
      // ESP32'ye gaz uyarısını gönder (GERÇEK HAT)
      // Format: GAS:450
      espSerial.print("GAS:");
      espSerial.println(gasValue);
    }
  }
  
  // Kısa bir bekleme
  delay(100);
}
