# Castle Card Battle V66 - Deploy Ready

Bu paket farklı evlerden oynamak için sunuculu hazırlandı.

## İçindekiler

- `server.js` - Node.js + WebSocket sunucusu
- `package.json` - bağımlılıklar ve başlatma komutu
- `render.yaml` - Render için hazır deploy ayarı
- `public/index.html` - oyun dosyası

## Bilgisayarda test

```bash
npm install
npm start
```

Sonra aç:

```text
http://localhost:3000
```

## Farklı evlerden oynamak için

Bu klasörü GitHub'a yükle, sonra Render'da Web Service olarak deploy et.

Render ayarları:

```text
Build Command: npm install
Start Command: npm start
```

Deploy bitince Render sana bir link verir:

```text
https://senin-oyunun.onrender.com
```

Sen ve arkadaşın aynı linke girince farklı evlerden oynayabilirsiniz.

## Not

Sunucu ücretsiz planda uykuya geçebilir. İlk girişte açılması biraz sürebilir.
