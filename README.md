# DUKA Diff

Sade, metinleri hiçbir yere göndermeyen bir metin karşılaştırma (diff) aracı.

Adres: **https://duka.tr/diff/**

**Gizlilik:** Karşılaştırma tamamen tarayıcıda (Web Worker içinde) yapılır. Metinler sunucuya hiç gönderilmez.
Site GitHub Pages üzerinde yalnızca statik dosyalardan oluşur ve çerez kullanmaz. CSP (`connect-src 'none'`)
sayfanın hiçbir yere ağ isteği yapmasına izin vermez. Tarayıcıda yalnızca tercihler saklanır (dil, tema, seçenekler),
metinler saklanmaz. Not: GitHub Pages, her web sunucusu gibi kendi erişim kayıtlarını (IP vb.) tutar.
Metin içerikleri bu kayıtlara girmez, çünkü hiç gönderilmez.

## Yayın

`main` dalına her push'ta [.github/workflows/pages.yml](.github/workflows/pages.yml) testleri çalıştırır,
`public/` klasörünü GitHub Pages'e yayınlar. Repo `duka-tr` organizasyonunda olduğu için site,
organizasyonun alan adı altında `duka.tr/diff/` adresinde açılır.

Yayın sırasında dosya adreslerindeki `__V__` ifadesi commit kimliğiyle değiştirilir. Böylece güncellemeden sonra
tarayıcılar eski dosyaları önbellekten kullanmaz.

Yerelde denemek için herhangi bir statik sunucu yeterlidir:

```bash
cd public && python3 -m http.server 8000
```

## Ayarlar (`public/config.js`)

| Alan | Varsayılan | Açıklama |
|---|---|---|
| `title` | `DUKA Diff` | Sekme ve sayfa başlığı |
| `tagline` | dile göre | Başlık yanındaki açıklama |
| `footer` | dile göre | Sayfa altı metni |
| `lang` | `tr` | `tr` veya `en` |
| `theme` | sistem ayarı | `light` veya `dark` |
| `view` | `split` | `split` (yan yana) veya `unified` (tek sütun) |
| `hide` | `false` | Değişmeyenleri gizle |
| `context` | `5` | Bağlam satırı: `0`, `3`, `5`, `10`, `20` |

Bunlar ilk ziyaretteki varsayılanlardır. Ziyaretçi sayfada kendisi bir seçim yaptıysa, tarayıcısında saklanan
bu seçim önceliklidir.

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
  config.js        Site ayarları
tests/             Diff motoru ve JSON biçimlendirme testleri
.github/workflows/ GitHub Pages yayını
```

## Test

Node.js 18 veya üstü gerekir:

```bash
node --test tests/diff.test.js
```
