/*
 * Site ayarları. Boş bırakılan / silinen alanlar için uygulama varsayılanı kullanılır.
 * Ziyaretçi sayfada kendisi bir seçim yaptıysa, tarayıcısında saklanan seçim önceliklidir.
 */
window.APP_CONFIG = {
  // title: 'DUKA Diff',            // Sekme ve sayfa başlığı (varsayılan: "DUKA Diff")
  // tagline: '',                   // Başlık yanındaki açıklama (varsayılan: dile göre gizlilik açıklaması)
  // footer: '',                    // Sayfa altı metni (varsayılan: dile göre)
  lang: 'tr',                       // Arayüz dili: 'tr' | 'en'
  // theme: 'dark',                 // Tema: 'light' | 'dark' (yoksa sistem ayarı)
  view: 'split',                    // Görünüm: 'split' (yan yana) | 'unified' (tek sütun)
  hide: false,                      // Değişmeyenleri gizle
  context: 5,                       // Gizlerken bırakılacak bağlam satırı: 0 | 3 | 5 | 10 | 20
};
