# DUKA Diff

Sade, log tutmayan bir metin karşılaştırma (diff) aracı.

**Gizlilik:** Karşılaştırma tamamen tarayıcıda (Web Worker içinde) yapılır. Metinler sunucuya hiç gönderilmez.
Sunucu yalnızca statik dosyaları verir. Erişim kaydı tutmaz ve çerez kullanmaz. CSP (`connect-src 'none'`)
sayfanın hiçbir yere ağ isteği yapmasına izin vermez. Tarayıcıda yalnızca tercihler saklanır (dil, tema, seçenekler),
metinler saklanmaz.

## Gereksinimler

- Docker ve Docker Compose v2

## Çalıştırma

```bash
cp .env.example .env      # ilk kurulumda; ayarları bu dosyadan düzenleyin
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

## Ayarlar (`.env`)

Tüm ayarlar `.env` dosyasındadır, açıklamalı örnek için [.env.example](.env.example) dosyasına bakın.
`.env` git'e eklenmez. Değişiklikten sonra `docker compose up -d` yeterlidir, imajı yeniden derlemek gerekmez.

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `BIND_ADDRESS` | `127.0.0.1` | Bağlanılacak adres (`127.0.0.1` = yalnızca bu makine) |
| `HOST_PORT` | `7080` | Dışarıya açılan port |
| `SITE_TITLE` | dile göre | Sekme ve sayfa başlığı |
| `SITE_TAGLINE` | dile göre | Başlık yanındaki açıklama |
| `SITE_FOOTER` | dile göre | Sayfa altı metni |
| `DEFAULT_LANG` | `tr` | `tr` veya `en` |
| `DEFAULT_THEME` | `auto` | `auto`, `light` veya `dark` |
| `DEFAULT_VIEW` | `split` | `split` (yan yana) veya `unified` (tek sütun) |
| `DEFAULT_HIDE_UNCHANGED` | `false` | Değişmeyenleri gizle |
| `DEFAULT_CONTEXT` | `5` | Bağlam satırı: `0`, `3`, `5`, `10`, `20` |

`DEFAULT_*` değerleri ilk ziyaretteki varsayılanlardır. Ziyaretçi sayfada kendisi bir seçim yaptıysa,
tarayıcısında saklanan bu seçim önceliklidir. Geçersiz bir değer girilirse konteyner log'una uyarı yazılır ve
uygulama varsayılanı kullanılır (`docker logs difference-checker`).

Güncelleme: dosyaları değiştirdikten sonra `docker compose up -d --build` komutunu tekrar çalıştırın.

## Özellikler

- Yan yana / tek sütun görünüm
- Biçim: düz metin, JSON veya XML
  - JSON: anahtar sırası ve girinti farkları yok sayılır, yalnızca veri farkları görünür. Dizi sırası ve sayıların
    yazımı korunur (büyük sayılar yuvarlanmaz, `1.50` ≠ `1.5`)
  - XML: öznitelik sırası ve girinti/boşluk farkları yok sayılır, element sırası korunur
  - Geçersiz girdide hangi tarafta, hangi satır/sütunda hata olduğu gösterilir
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
  format.js        JSON/XML normalleştirme
  index.html       Sayfa
  style.css        Stiller (açık/koyu tema)
  favicon.svg      Simge
  config.js        (konteynerde .env'den üretilir, repoda yok)
nginx/default.conf Güvenlik başlıkları, log kapalı, yalnızca GET/HEAD
docker/            Açılışta .env'den config.js üreten betik
tests/             Diff motoru ve JSON biçimlendirme testleri
Dockerfile         nginx-unprivileged (alpine) imajı
docker-compose.yml Port/ayarlar .env'den, salt okunur, yetkisiz konteyner
.env.example       Ayar şablonu
```

## Test

Node.js 18 veya üstü gerekir:

```bash
node --test tests/diff.test.js
```
