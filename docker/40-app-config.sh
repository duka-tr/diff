#!/bin/sh
# .env'deki site ayarlarından tarayıcının okuyacağı /tmp/app-config.js dosyasını üretir.
set -eu

OUT=/tmp/app-config.js

# JSON metin değeri: ters bölü ve tırnakları kaçır, satır sonlarını boşluğa çevir.
str() {
  printf '"%s"' "$(printf '%s' "$1" | tr '\r\n' '  ' | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

# Seçenek listesinde değilse uyarı verip boş bırakır (uygulama varsayılanı kullanılır).
pick() {
  name=$1; value=$2; shift 2
  [ -z "$value" ] && return 0
  for allowed in "$@"; do
    [ "$value" = "$allowed" ] && { printf '%s' "$value"; return 0; }
  done
  echo "app-config: $name='$value' geçersiz (izinli: $*), varsayılan kullanılıyor" >&2
}

lang=$(pick DEFAULT_LANG "${DEFAULT_LANG:-}" tr en)
theme=$(pick DEFAULT_THEME "${DEFAULT_THEME:-}" auto light dark)
view=$(pick DEFAULT_VIEW "${DEFAULT_VIEW:-}" split unified)
hide=$(pick DEFAULT_HIDE_UNCHANGED "${DEFAULT_HIDE_UNCHANGED:-}" true false)
context=$(pick DEFAULT_CONTEXT "${DEFAULT_CONTEXT:-}" 0 3 5 10 20)

{
  printf 'window.APP_CONFIG = {'
  [ -n "${SITE_TITLE:-}" ] && printf ' title: %s,' "$(str "$SITE_TITLE")"
  [ -n "${SITE_TAGLINE:-}" ] && printf ' tagline: %s,' "$(str "$SITE_TAGLINE")"
  [ -n "${SITE_FOOTER:-}" ] && printf ' footer: %s,' "$(str "$SITE_FOOTER")"
  [ -n "$lang" ] && printf ' lang: "%s",' "$lang"
  [ -n "$theme" ] && [ "$theme" != auto ] && printf ' theme: "%s",' "$theme"
  [ -n "$view" ] && printf ' view: "%s",' "$view"
  [ -n "$hide" ] && printf ' hide: %s,' "$hide"
  [ -n "$context" ] && printf ' context: %s,' "$context"
  printf ' };\n'
} > "$OUT"

echo "app-config: $OUT yazıldı" >&2
