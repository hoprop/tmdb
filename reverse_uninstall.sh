#!/usr/bin/env bash

set -euo pipefail

# ---------------------------
#  Helpers / common things
# ---------------------------

red()   { echo -e "\e[31m$*\e[0m"; }
green() { echo -e "\e[32m$*\e[0m"; }
yellow(){ echo -e "\e[33m$*\e[0m"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    red "Этот скрипт нужно запускать от root."
    exit 1
  fi
}

detect_pm() {
  if command -v apt-get >/dev/null 2>&1; then
    PM="apt"
  elif command -v yum >/dev/null 2>&1; then
    PM="yum"
  elif command -v dnf >/dev/null 2>&1; then
    PM="dnf"
  else
    PM=""
  fi
}

pm_purge() {
  local pkgs=("$@")
  [[ -z "$PM" ]] && return 0

  case "$PM" in
    apt)
      DEBIAN_FRONTEND=noninteractive apt-get purge -y "${pkgs[@]}" 2>/dev/null || true
      DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>/dev/null || true
      ;;
    yum|dnf)
      "$PM" remove -y "${pkgs[@]}" 2>/dev/null || true
      ;;
  esac
}

svc_stop_disable() {
  local svc="$1"
  systemctl stop "$svc" 2>/dev/null || true
  systemctl disable "$svc" 2>/dev/null || true
}

backup_if_exists() {
  local src="$1"
  local dst_dir="$2"
  if [[ -e "$src" ]]; then
    mkdir -p "$dst_dir"
    local base
    base="$(basename "$src")"
    cp -a "$src" "$dst_dir/$base" 2>/dev/null || true
  fi
}

# ---------------------------
#  Main remove logic
# ---------------------------

require_root
detect_pm

TIMESTAMP="$(date +%F_%H-%M-%S)"
BACKUP_ROOT="/root/reverse_proxy_uninstall_${TIMESTAMP}"
mkdir -p "$BACKUP_ROOT"

green "==> Создаю резервные копии в: $BACKUP_ROOT"

# Бэкап конфигов и данных, которые будем трогать
backup_if_exists "/etc/nginx"               "$BACKUP_ROOT"
backup_if_exists "/usr/local/reverse_proxy" "$BACKUP_ROOT"
backup_if_exists "/usr/local/x-ui"          "$BACKUP_ROOT"
backup_if_exists "/etc/x-ui"                "$BACKUP_ROOT"
backup_if_exists "/var/www/html"            "$BACKUP_ROOT"
backup_if_exists "/var/www/subpage"         "$BACKUP_ROOT"
backup_if_exists "/etc/default/shellinabox" "$BACKUP_ROOT"
backup_if_exists "/etc/systemd/resolved.conf" "$BACKUP_ROOT"
backup_if_exists "/etc/AdGuardHome.yaml"    "$BACKUP_ROOT"
backup_if_exists "/opt/AdGuardHome"         "$BACKUP_ROOT"
backup_if_exists "/var/lib/AdGuardHome"     "$BACKUP_ROOT"
backup_if_exists "/etc/systemd/system/x-ui.service" "$BACKUP_ROOT"
backup_if_exists "/etc/systemd/system/node_exporter.service" "$BACKUP_ROOT"

# Логи reverse_proxy
backup_if_exists "/usr/local/reverse_proxy/reverse_proxy.log" "$BACKUP_ROOT"

green "==> Останавливаю и отключаю сервисы (если есть)"

# x-ui / 3x-ui
svc_stop_disable "x-ui"

# nginx
svc_stop_disable "nginx"

# AdGuardHome
svc_stop_disable "AdGuardHome"

# shellinabox
svc_stop_disable "shellinabox"

# node_exporter (ставился скриптом мониторинга)
svc_stop_disable "node_exporter"

# cloudflare warp
svc_stop_disable "warp-svc"
svc_stop_disable "warp-svc.service"

# на всякий случай systemd daemon-reload потом
systemctl daemon-reload 2>/dev/null || true

green "==> Чищу cron-задачи reverse_proxy / sub2sing-box / certbot renew (скриптовые)"

CRON_TMP="$(mktemp)"
crontab -l 2>/dev/null | \
  grep -v "/usr/local/reverse_proxy" | \
  grep -v "sub2sing-box server --bind 127.0.0.1 --port 8080" | \
  grep -v "certbot -q renew" \
  > "$CRON_TMP" || true
crontab "$CRON_TMP" 2>/dev/null || true
rm -f "$CRON_TMP"

green "==> Удаляю бинарники и служебные файлы"

# reverse_proxy менеджер
rm -f /usr/local/bin/reverse_proxy 2>/dev/null || true
rm -rf /usr/local/reverse_proxy 2>/dev/null || true

# x-ui (3x-ui)
rm -rf /usr/local/x-ui 2>/dev/null || true
rm -rf /etc/x-ui 2>/dev/null || true
rm -rf /var/lib/x-ui 2>/dev/null || true
rm -f /etc/systemd/system/x-ui.service 2>/dev/null || true

# AdGuardHome
rm -rf /opt/AdGuardHome 2>/dev/null || true
rm -rf /var/lib/AdGuardHome 2>/dev/null || true
rm -f /etc/systemd/system/AdGuardHome.service 2>/dev/null || true
rm -f /etc/AdGuardHome.yaml 2>/dev/null || true

# shellinabox
rm -f /etc/default/shellinabox 2>/dev/null || true

# sub2sing-box
rm -f /usr/bin/sub2sing-box 2>/dev/null || true

# node_exporter (если его кладли в стандартное место)
rm -f /usr/local/bin/node_exporter 2>/dev/null || true
rm -f /etc/systemd/system/node_exporter.service 2>/dev/null || true

# NGINX конфиги, которые создавал скрипт
green "==> Чищу конфиги NGINX, созданные скриптом"

rm -rf /etc/nginx/stream-enabled 2>/dev/null || true
rm -rf /etc/nginx/locations 2>/dev/null     || true
rm -f  /etc/nginx/conf.d/local.conf 2>/dev/null || true
rm -f  /etc/nginx/dhparam.pem 2>/dev/null       || true
rm -f  /etc/nginx/.htpasswd 2>/dev/null         || true

# Веб-контент, который заливал скрипт
rm -rf /var/www/subpage 2>/dev/null || true
# Будь осторожен: это сносит текущий /var/www/html
rm -rf /var/www/html 2>/dev/null || true

green "==> (Опционально) удаляю пакеты, установленные скриптом"

# Набор пакетов, которые с большой вероятностью ставил именно наш установщик
pm_purge nginx nginx-full nginx-core nginx-common \
         shellinabox cloudflare-warp \
         p7zip-full node-exporter \
         certbot python3-certbot-dns-cloudflare \
         ufw jq vnstat

green "==> Перезагружаю systemd-юниты"
systemctl daemon-reload 2>/dev/null || true

yellow "==> Готово."
yellow "Резервные копии всего, что трогали, лежат в: $BACKUP_ROOT"
yellow "Если нужно полностью снести сертификаты Let's Encrypt: 'rm -rf /etc/letsencrypt' (ОСТОРОЖНО!)."
yellow "Если нужно вернуть свои настройки SSH/systemd-resolved — смотри бэкапы в $BACKUP_ROOT."
