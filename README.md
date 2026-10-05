# Metin Karşılaştırma

Sade, log tutmayan bir metin karşılaştırma (diff) aracı.

**Gizlilik:** Karşılaştırma tamamen tarayıcıda (Web Worker içinde) yapılır. Metinler sunucuya hiç gönderilmez.
Sunucu yalnızca statik dosyaları verir. Erişim kaydı tutmaz ve çerez kullanmaz. CSP (`connect-src 'none'`)
sayfanın hiçbir yere ağ isteği yapmasına izin vermez. Tarayıcıda yalnızca tercihler saklanır (dil, tema, seçenekler),
metinler saklanmaz.

## Gereksinimler

- Docker ve Docker Compose v2

## Çalıştırma

```bash
docker compose up -d --build
```

Uygulama `http://127.0.0.1:7080` adresinde açılır. Port yalnızca makinenin içinden erişilebilir.
Dışarıya Cloudflare Tunnel ile açmak için tünelin servisini `http://127.0.0.1:7080` olarak ayarlayın.
Örneğin `cloudflared` yapılandırmasında:

```yaml
ingress:
  - hostname: diff.ornek.com
    service: http://127.0.0.1:7080
  - service: http_status:404
```

Portu değiştirmek için `docker-compose.yml` içindeki `127.0.0.1:7080:8080` satırındaki `7080` değerini değiştirin.

Güncelleme: dosyaları değiştirdikten sonra `docker compose up -d --build` komutunu tekrar çalıştırın.

## Özellikler

- Yan yana / tek sütun görünüm
- Satır içi fark vurgusu: kelime, karakter ya da kapalı
- Yok sayma seçenekleri: baştaki/sondaki boşluklar veya tüm boşluklar, büyük/küçük harf, boş satırlar
- Türkçe harf kuralları (büyük/küçük harf yok sayılırken): açıkken I↔ı, İ↔i (`SATIR` = `satır`, `kır` ≠ `kir`);
  kapalıyken I/ı/İ/i aynı sayılır (`FILE` = `file` de eşleşir)
- Metin yapıştırınca veya dosya açınca imleç metnin başına gelir
- CRLF/LF farkı her zaman yok sayılır
- Değişmeyenleri gizle: değişikliklerin etrafında 0/3/5/10/20 satır bağlam kalır, gizli bloklar tıklanınca açılır
- Değişiklikler arası gezinme: `Alt+↓` / `Alt+↑`
- `Ctrl+Enter` ile karşılaştırma
- Dosya açma ve sürükle-bırak (dosya da yalnızca tarayıcıda okunur)
- Türkçe / İngilizce arayüz, açık / koyu tema

## Yapı

```
public/            Statik site (derleme adımı yok, bağımlılık yok)
  diff.js          Diff motoru (Myers O(ND), doğrusal bellek)
  worker.js        Karşılaştırmayı arka planda çalıştırır
  app.js           Arayüz
  i18n.js          TR/EN metinleri
  index.html       Sayfa
  style.css        Stiller (açık/koyu tema)
  favicon.svg      Simge
nginx/default.conf Güvenlik başlıkları, log kapalı, yalnızca GET/HEAD
tests/             Diff motoru testleri
Dockerfile         nginx-unprivileged (alpine) imajı
docker-compose.yml 127.0.0.1:7080, salt okunur, yetkisiz konteyner
```

## Test

Node.js 18 veya üstü gerekir:

```bash
node --test tests/diff.test.js
```
