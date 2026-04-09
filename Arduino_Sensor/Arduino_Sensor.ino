// HC-SR04 Sensör Pin Tanımlamaları
const int trigPin = 9;
const int echoPin = 10;

// Değişkenler
long duration;
float distance;
unsigned long lastSendTime = 0;
const int sendInterval = 2000; // 2 saniye cooldown

void setup() {
  Serial.begin(115200); // ESP32 ile aynı baud rate
  
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
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
      
      // ESP32'ye veriyi gönder
      // Format: DISTANCE:45.50
      Serial.print("DISTANCE:");
      Serial.println(distance);
    }
  }
  
  // Kısa bir bekleme
  delay(100);
}
