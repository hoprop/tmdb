#!/usr/bin/env bash

###################################
### Global values
###################################
VERSION_MANAGER='1.4.4'
VERSION=v2.4.11

DIR_REVERSE_PROXY="/usr/local/reverse_proxy/"
LANG_FILE="/usr/local/reverse_proxy/lang.conf"
DEFAULT_FLAGS="/usr/local/reverse_proxy/default.conf"
DEST_DB="/etc/x-ui/x-ui.db"

SCRIPT_URL="https://raw.githubusercontent.com/cortez24rus/xui-reverse-proxy/refs/heads/main/reverse_proxy.sh"
DB_SCRIPT_URL="https://raw.githubusercontent.com/cortez24rus/xui-reverse-proxy/refs/heads/main/database/x-ui.db"

###################################
### Initialization and Declarations
###################################
declare -A defaults
declare -A args
declare -A regex
declare -A generate

###################################
### Regex Patterns for Validation
###################################
regex[domain]="^([a-zA-Z0-9-]+)\.([a-zA-Z0-9-]+\.[a-zA-Z]{2,})$"
regex[port]="^[1-9][0-9]*$"
regex[warp_license]="^[a-zA-Z0-9]{8}-[a-zA-Z0-9]{8}-[a-zA-Z0-9]{8}$"
regex[username]="^[a-zA-Z0-9]+$"
regex[ip]="^([0-9]{1,3}\.){3}[0-9]{1,3}$"
regex[tgbot_token]="^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$"
regex[tgbot_admins]="^[a-zA-Z][a-zA-Z0-9_]{4,31}(,[a-zA-Z][a-zA-Z0-9_]{4,31})*$"
regex[domain_port]="^[a-zA-Z0-9]+([-.][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}(:[1-9][0-9]*)?$"
regex[file_path]="^[a-zA-Z0-9_/.-]+$"
regex[url]="^(http|https)://([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(:[0-9]{1,5})?(/.*)?$"
generate[path]="tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 30"

###################################
### INFO
###################################
out_data()   { echo -e "\e[1;33m$1\033[0m \033[1;37m$2\033[0m"; }
tilda()      { echo -e "\033[31m\033[38;5;214m$*\033[0m"; }
warning()    { echo -e "\033[31m [!]\033[38;5;214m$*\033[0m"; }
error()      { echo -e "\033[31m\033[01m$*\033[0m"; exit 1; }
info()       { echo -e "\033[32m\033[01m$*\033[0m"; }
question()   { echo -e "\033[32m[?]\e[1;33m$*\033[0m"; }
hint()       { echo -e "\033[33m\033[01m$*\033[0m"; }
reading()    { read -rp " $(question "$1")" "$2"; }
text()       { eval echo "\${${L}[$*]}"; }
text_eval()  { eval echo "\$(eval echo "\${${L}[$*]}")"; }

###################################
### Languages
###################################
E[0]="Language:\n  1. English (default) \n  2. Русский"
R[0]="Язык:\n  1. English (по умолчанию) \n  2. Русский"
E[1]="Choose an action:"
R[1]="Выбери действие:"
E[2]="Error: this script requires superuser (root) privileges to run."
R[2]="Ошибка: для выполнения этого скрипта необходимы права суперпользователя (root)."
E[3]="Unable to determine IP address."
R[3]="Не удалось определить IP-адрес."
E[4]="Reinstalling script..."
R[4]="Повторная установка скрипта..."
E[5]="WARNING!"
R[5]="ВНИМАНИЕ!"
E[6]="It is recommended to perform the following actions before running the script"
R[6]="Перед запуском скрипта рекомендуется выполнить следующие действия"
E[7]="Annihilation of the system!"
R[7]="Аннигиляция системы!"
E[8]="Start the XRAY installation? Choose option [y/N]:"
R[8]="Начать установку XRAY? Выберите опцию [y/N]:"
E[9]="CANCEL"
R[9]="ОТМЕНА"
E[10]="\n|--------------------------------------------------------------------------|\n"
R[10]="\n|--------------------------------------------------------------------------|\n"
E[11]="Enter username:"
R[11]="Введите имя пользователя:"
E[12]="Enter user password:"
R[12]="Введите пароль пользователя:"
E[13]="Enter your domain A record:"
R[13]="Введите доменную запись типа A:"
E[14]="Error: the entered address '$temp_value' is incorrectly formatted."
R[14]="Ошибка: введённый адрес '$temp_value' имеет неверный формат."
E[15]="Enter your email registered with Cloudflare:"
R[15]="Введите вашу почту, зарегистрированную на Cloudflare:"
E[16]="Enter your Cloudflare API token (Edit zone DNS) or global API key:"
R[16]="Введите ваш API токен Cloudflare (Edit zone DNS) или Cloudflare global API key:"
E[17]="Verifying domain, API token/key, and email..."
R[17]="Проверка домена, API токена/ключа и почты..."
E[18]="Error: invalid domain, API token/key, or email. Please try again."
R[18]="Ошибка: неправильно введён домен, API токен/ключ или почта. Попробуйте снова."
E[19]="Enter SNI for Reality (do not enter your domain):"
R[19]="Введите SNI для Reality (не вводите ваш домен):"
E[20]="Error: failed to connect to WARP. Manual acceptance of the terms of service is required."
R[20]="Ошибка: не удалось подключиться к WARP. Требуется вручную согласиться с условиями использования."
E[21]="Access link to node exporter:"
R[21]="Доступ по ссылке к node exporter:"
E[22]="Access link to shell in a box:"
R[22]="Доступ по ссылке к shell in a box:"
E[23]="Creating a backup and rotation."
R[23]="Создание резевной копии и ротация."
E[24]="Enter Node Exporter path:"
R[24]="Введите путь к Node Exporter:"
E[25]="Enter Adguard-home path:"
R[25]="Введите путь к Adguard-home:"
E[26]="Enter panel path:"
R[26]="Введите путь к панели:"
E[27]="Enter subscription path:"
R[27]="Введите путь к подписке:"
E[28]="Enter JSON subscription path:"
R[28]="Введите путь к JSON подписке:"
E[29]="Error: path cannot be empty, please re-enter."
R[29]="Ошибка: путь не может быть пустым, повторите ввод."
E[30]="Error: path must not contain characters {, }, /, $, \\, please re-enter."
R[30]="Ошибка: путь не должен содержать символы {, }, /, $, \\, повторите ввод."
E[31]="DNS server:\n  1. Systemd-resolved \n  2. Adguard-home"
R[31]="DNS сервер:\n  1. Systemd-resolved \n  2. Adguard-home"
E[32]="Systemd-resolved selected."
R[32]="Выбран systemd-resolved."
E[33]="Error: invalid choice, please try again."
R[33]="Ошибка: неверный выбор, попробуйте снова."
E[34]="Enter the Telegram bot token for the control panel:"
R[34]="Введите токен Telegram бота для панели управления:"
E[35]="Enter your Telegram ID:"
R[35]="Введите ваш Telegram ID:"
E[36]="Updating system and installing necessary packages."
R[36]="Обновление системы и установка необходимых пакетов."
E[37]="Configuring DNS."
R[37]="Настройка DNS."
E[38]="Download failed, retrying..."
R[38]="Скачивание не удалось, пробуем снова..."
E[39]="Adding user."
R[39]="Добавление пользователя."
E[40]="Enabling automatic security updates."
R[40]="Автоматическое обновление безопасности."
E[41]="Enabling BBR."
R[41]="Включение BBR."
E[42]="Disabling IPv6."
R[42]="Отключение IPv6."
E[43]="Configuring WARP."
R[43]="Настройка WARP."
E[44]="Issuing certificates."
R[44]="Выдача сертификатов."
E[45]="Configuring NGINX."
R[45]="Настройка NGINX."
E[46]="Setting up the panel for Xray."
R[46]="Настройка панели для Xray."
E[47]="Configuring UFW."
R[47]="Настройка UFW."
E[48]="Configuring SSH."
R[48]="Настройка SSH."
E[49]="Generate a key for your OS (ssh-keygen)."
R[49]="Сгенерируйте ключ для своей ОС (ssh-keygen)."
E[50]="In Windows, install the openSSH package and enter the command in PowerShell (recommended to research key generation online)."
R[50]="В Windows нужно установить пакет openSSH и ввести команду в PowerShell (рекомендуется изучить генерацию ключей в интернете)."
E[51]="If you are on Linux, you probably know what to do C:"
R[51]="Если у вас Linux, то вы сами все умеете C:"
E[52]="Command for Windows:"
R[52]="Команда для Windows:"
E[53]="Command for Linux:"
R[53]="Команда для Linux:"
E[54]="Configure SSH (optional step)? [y/N]:"
R[54]="Настроить SSH (необязательный шаг)? [y/N]:"
E[55]="Error: Keys not found. Please add them to the server before retrying..."
R[55]="Ошибка: ключи не найдены, добавьте его на сервер, прежде чем повторить..."
E[56]="Key found, proceeding with SSH setup."
R[56]="Ключ найден, настройка SSH."
E[57]="Installing bot."
R[57]="Установка бота."
E[58]="SAVE THIS SCREEN!"
R[58]="СОХРАНИ ЭТОТ ЭКРАН!"
E[59]="Access the panel at the link:"
R[59]="Доступ по ссылке к панели:"
E[60]="Quick subscription link for connection:"
R[60]="Быстрая ссылка на подписку для подключения:"
E[61]="Access Adguard-home at the link:"
R[61]="Доступ по ссылке к adguard-home:"
E[62]="SSH connection:"
R[62]="Подключение по SSH:"
E[63]="Username:"
R[63]="Имя пользователя:"
E[64]="Password:"
R[64]="Пароль:"
E[65]="Log file path:"
R[65]="Путь к лог файлу:"
E[66]="Prometheus monitor."
R[66]="Мониторинг Prometheus."
E[67]="Set up the Telegram bot? [y/N]:"
R[67]="Настроить telegram бота? [y/N]:"
E[68]="Bot:\n  1. IP limit (default) \n  2. Torrent ban"
R[68]="Бот:\n  1. IP limit (по умолчанию) \n  2. Torrent ban"
E[69]="Enter the Telegram bot token for IP limit, Torrent ban:"
R[69]="Введите токен Telegram бота для IP limit, Torrent ban:"
E[70]="Secret key:"
R[70]="Секретный ключ:"
E[71]="Current operating system is \$SYS.\\\n The system lower than \$SYSTEM \${MAJOR[int]} is not supported. Feedback: [https://github.com/cortez24rus/xui-reverse-proxy/issues]"
R[71]="Текущая операционная система: \$SYS.\\\n Система с версией ниже, чем \$SYSTEM \${MAJOR[int]}, не поддерживается. Обратная связь: [https://github.com/cortez24rus/xui-reverse-proxy/issues]"
E[72]="Install dependence-list:"
R[72]="Список зависимостей для установки:"
E[73]="All dependencies already exist and do not need to be installed additionally."
R[73]="Все зависимости уже установлены и не требуют дополнительной установки."
E[74]="OS - $SYS"
R[74]="OS - $SYS"
E[75]="Invalid option for --$key: $value. Use 'true' or 'false'."
R[75]="Неверная опция для --$key: $value. Используйте 'true' или 'false'."
E[76]="Unknown option: $1"
R[76]="Неверная опция: $1"
E[77]="List of dependencies for installation:"
R[77]="Список зависимостей для установки:"
E[78]="All dependencies are already installed and do not require additional installation."
R[78]="Все зависимости уже установлены и не требуют дополнительной установки."
E[79]="Configuring site template."
R[79]="Настройка шаблона сайта."
E[80]="Random template name:"
R[80]="Случайное имя шаблона:"
E[81]="Enter your domain CNAME record:"
R[81]="Введите доменную запись типа CNAME:"
E[82]="Enter Shell in a box path:"
R[82]="Введите путь к Shell in a box:"
E[83]="Terminal emulator Shell in a box."
R[83]="Эмулятор терминала Shell in a box."
E[84]="0. Exit script"
R[84]="0. Выход из скрипта"
E[85]="Press Enter to return to the menu..."
R[85]="Нажмите Enter, чтобы вернуться в меню..."
E[86]="Reverse proxy manager $VERSION_MANAGER"
R[86]="Reverse proxy manager $VERSION_MANAGER"
E[87]="1. Standard installation"
R[87]="1. Стандартная установка"
E[88]="2. Restore from a rescue copy."
R[88]="2. Восстановление из резевной копии."
E[89]="3. Migration to a new version with client retention."
R[89]="3. Миграция на новую версию с сохранением клиентов."
E[90]="4. Change the domain name for the proxy."
R[90]="4. Изменить доменное имя для прокси."
E[91]="5. Forced reissue of certificates."
R[91]="5. Принудительный перевыпуск сертификатов."
E[92]="6. Integrate custom JSON subscription."
R[92]="6. Интеграция кастомной JSON подписки."
E[93]="7. Copy someone else's website to your server."
R[93]="7. Скопировать чужой сайт на ваш сервер."
E[94]="8. Disable IPv6."
R[94]="8. Отключение IPv6."
E[95]="9. Enable IPv6."
R[95]="9. Включение IPv6."
E[96]="10. Find out the size of the directory."
R[96]="10. Узнать размер директории."
E[97]="Client migration initiation (experimental feature)."
R[97]="Начало миграции клиентов (экспериментальная функция)."
E[98]="Client migration is complete."
R[98]="Миграция клиентов завершена."
E[99]="Settings custom JSON subscription."
R[99]="Настройки пользовательской JSON-подписки."
E[100]="Restore from backup."
R[100]="Восстановление из резервной копии."
E[101]="Backups:"
R[101]="Резервные копии:"
E[102]="Enter the number of the archive to restore:"
R[102]="Введите номер архива для восстановления:"
E[103]="Restoration is complete."
R[103]="Восстановление завершено."
E[104]="Restoration is complete."
R[104]="Выбран архив:"
E[105]="11. Traffic statistics."
R[105]="11. Статистика трафика."
E[106]="Traffic statistics:\n  1. By years \n  2. By months \n  3. By days \n  4. By hours"
R[106]="Статистика трафика:\n  1. По годам \n  2. По месяцам \n  3. По дням \n  4. По часам"
E[107]="12. Change language."
R[107]="12. Изменить язык."

###################################
### Help output
###################################
show_help() {
  echo
  echo "Usage: reverse_proxy [-u|--utils <true|false>] [-d|--dns <true|false>] [-a|--addu <true|false>]"
  echo "         [-r|--autoupd <true|false>] [-b|--bbr <true|false>] [-i|--ipv6 <true|false>] [-w|--warp <true|false>]"
  echo "         [-c|--cert <true|false>] [-m|--mon <true|false>] [-l|--shell <true|false>] [-n|--nginx <true|false>]"
  echo "         [-p|--panel <true|false>] [--custom <true|false>] [-f|--firewall <true|false>] [-s|--ssh <true|false>]"
  echo "         [-t|--tgbot <true|false>] [-g|--generate <true|false>] [-x|--skip-check <true|false>] [-o|--subdomain <true|false>]"
  echo "         [--update] [-h|--help]"
  echo
  echo "  -u, --utils <true|false>       Additional utilities                             (default: ${defaults[utils]})"
  echo "                                 Дополнительные утилиты"
  echo "  -d, --dns <true|false>         DNS encryption                                   (default: ${defaults[dns]})"
  echo "                                 Шифрование DNS"
  echo "  -a, --addu <true|false>        User addition                                    (default: ${defaults[addu]})"
  echo "                                 Добавление пользователя"
  echo "  -r, --autoupd <true|false>     Automatic updates                                (default: ${defaults[autoupd]})"
  echo "                                 Автоматические обновления"
  echo "  -b, --bbr <true|false>         BBR (TCP Congestion Control)                     (default: ${defaults[bbr]})"
  echo "                                 BBR (управление перегрузкой TCP)"
  echo "  -i, --ipv6 <true|false>        Disable IPv6 support                             (default: ${defaults[ipv6]})"
  echo "                                 Отключить поддержку IPv6 "
  echo "  -w, --warp <true|false>        WARP setting                                     (default: ${defaults[warp]})"
  echo "                                 Настройка WARP"
  echo "  -c, --cert <true|false>        Certificate issuance for domain                  (default: ${defaults[cert]})"
  echo "                                 Выпуск сертификатов для домена"
  echo "  -m, --mon <true|false>         Monitoring services (node_exporter)              (default: ${defaults[mon]})"
  echo "                                 Сервисы мониторинга (node_exporter)"
  echo "  -l, --shell <true|false>       Shell In A Box installation                      (default: ${defaults[shell]})"
  echo "                                 Установка Shell In A Box"
  echo "  -n, --nginx <true|false>       NGINX installation                               (default: ${defaults[nginx]})"
  echo "                                 Установка NGINX"
  echo "  -p, --panel <true|false>       Panel installation for user management           (default: ${defaults[panel]})"
  echo "                                 Установка панели для управления пользователями"
  echo "      --custom <true|false>      Custom JSON subscription                         (default: ${defaults[custom]})"
  echo "                                 Кастомная JSON-подписка"  
  echo "  -f, --firewall <true|false>    Firewall configuration                           (default: ${defaults[firewall]})"
  echo "                                 Настройка файрвола"
  echo "  -s, --ssh <true|false>         SSH access                                       (default: ${defaults[ssh]})"
  echo "                                 SSH доступ"
  echo "  -t, --tgbot <true|false>       Telegram bot integration                         (default: ${defaults[tgbot]})"
  echo "                                 Интеграция Telegram бота"
  echo "  -g, --generate <true|false>    Generate a random string for configuration       (default: ${defaults[generate]})"
  echo "                                 Генерация случайных путей для конфигурации"
  echo "  -x, --skip-check <true|false>  Disable the check functionality                  (default: ${defaults[skip-check]})"
  echo "                                 Отключение проверки"
  echo "  -o, --subdomain <true|false>   Support for subdomains                           (default: ${defaults[subdomain]})"
  echo "                                 Поддержка субдоменов"
  echo "      --update                   Update version of Reverse-proxy manager (Version on github: ${VERSION_MANAGER})"
  echo "                                 Обновить версию Reverse-proxy manager (Версия на github: ${VERSION_MANAGER})"
  echo "  -h, --help                     Display this help message"
  echo "                                 Показать это сообщение помощи"
  echo
  exit 0
}

###################################
### Reverse_proxy manager
###################################
update_reverse_proxy() {
  info "Script update and integration."

  CURRENT_VERSION=$(wget -qO- $SCRIPT_URL | grep -E "^\s*VERSION_MANAGER=" | cut -d'=' -f2)
  warning "Script version: $CURRENT_VERSION"
  UPDATE_SCRIPT="${DIR_REVERSE_PROXY}reverse_proxy"
  wget -O $UPDATE_SCRIPT $SCRIPT_URL
  ln -sf $UPDATE_SCRIPT /usr/local/bin/reverse_proxy
  chmod +x "$UPDATE_SCRIPT"

  crontab -l | grep -v -- "--update" | crontab -
  add_cron_rule "0 0 * * * /usr/local/reverse_proxy/reverse_proxy --update"

  tilda "\n|-----------------------------------------------------------------------------|\n"
}

###################################
### Reading values ​​from file
################################### 
read_defaults_from_file() {
  if [[ -f $DEFAULT_FLAGS ]]; then
    while IFS= read -r line; do
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      eval "$line"
    done < $DEFAULT_FLAGS
  else
    defaults[utils]=true
    defaults[dns]=true
    defaults[addu]=true
    defaults[autoupd]=true
    defaults[bbr]=true
    defaults[ipv6]=true
    defaults[warp]=false
    defaults[cert]=true
    defaults[mon]=false
    defaults[shell]=false
    defaults[nginx]=true
    defaults[panel]=true
    defaults[custom]=true
    defaults[firewall]=true
    defaults[ssh]=true
    defaults[tgbot]=false
    defaults[generate]=true
    defaults[skip-check]=false
    defaults[subdomain]=false
  fi
}

###################################
### Writing values ​​to a file
###################################
write_defaults_to_file() {
  cat > ${DEFAULT_FLAGS}<<EOF
defaults[utils]=false
defaults[dns]=false
defaults[addu]=false
defaults[autoupd]=false
defaults[bbr]=false
defaults[ipv6]=false
defaults[warp]=false
defaults[cert]=false
defaults[mon]=false
defaults[shell]=false
defaults[nginx]=true
defaults[panel]=true
defaults[custom]=true
defaults[firewall]=false
defaults[ssh]=false
defaults[tgbot]=false
defaults[generate]=true
defaults[skip-check]=false
defaults[subdomain]=false
EOF
}

###################################
### Lowercase characters
################################### 
normalize_case() {
  local key=$1
  args[$key]="${args[$key],,}"
}

###################################
### Validation of true/false value
###################################
validate_true_false() {
  local key=$1
  local value=$2
  case ${value} in
    true)  args[$key]=true ;;
    false) args[$key]=false ;;
    *)     warning " $(text 75) "; return 1 ;;
  esac
}

###################################
### Parse args
###################################
declare -A arg_map=(
  [-u]=utils      [--utils]=utils
  [-d]=dns        [--dns]=dns
  [-a]=addu       [--addu]=addu
  [-r]=autoupd    [--autoupd]=autoupd
  [-b]=bbr        [--bbr]=bbr
  [-i]=ipv6       [--ipv6]=ipv6
  [-w]=warp       [--warp]=warp
  [-c]=cert       [--cert]=cert
  [-m]=mon        [--mon]=mon
  [-l]=shell      [--shell]=shell
  [-n]=nginx      [--nginx]=nginx
  [-p]=panel      [--panel]=panel
                  [--custom]=custom
  [-f]=firewall   [--firewall]=firewall
  [-s]=ssh        [--ssh]=ssh
  [-t]=tgbot      [--tgbot]=tgbot
  [-g]=generate   [--generate]=generate
  [-x]=skip-check [--skip-check]=skip-check
  [-o]=subdomain  [--subdomain]=subdomain
)

parse_args() {
  local opts
  opts=$(getopt -o hu:d:a:r:b:i:w:c:m:l:n:p:f:s:t:g:x:o --long utils:,dns:,addu:,autoupd:,bbr:,ipv6:,warp:,cert:,mon:,shell:,nginx:,panel:,custom:,firewall:,ssh:,tgbot:,generate:,skip-check:,subdomain:,update,depers,help -- "$@")

  if [[ $? -ne 0 ]]; then
    return 1
  fi

  eval set -- "$opts"
  while true; do
    case $1 in
      --update)
        echo
        update_reverse_proxy
        exit 0
        ;;
      --depers)
        echo "Depersonalization database..."
        depersonalization_db
        exit 0
        ;;
      -h|--help)
        return 1
        ;;
      --)
        shift
        break
        ;;
      *)
        if [[ -n "${arg_map[$1]}" ]]; then
          local key="${arg_map[$1]}"
          args[$key]="$2"
          normalize_case "$key"
          validate_true_false "$key" "$2" || return 1
          shift 2
          continue
        fi
        warning " $(text 76) "
        return 1
        ;;
    esac
  done

  for key in "${!defaults[@]}"; do
    if [[ -z "${args[$key]}" ]]; then
      args[$key]=${defaults[$key]}
    fi
  done
}

###################################
### Logging
###################################
log_entry() {
  mkdir -p ${DIR_REVERSE_PROXY}
  LOGFILE="${DIR_REVERSE_PROXY}reverse_proxy.log"
  exec > >(tee -a "$LOGFILE") 2>&1
}

###################################
### Language selection
###################################
select_language() {
  if [ ! -f "$LANG_FILE" ]; then
    L=E
    hint " $(text 0) \n" 
    reading " $(text 1) " LANGUAGE

    case "$LANGUAGE" in
      1) L=E ;;
      2) L=R ;;
      *) L=E ;;
    esac
    cat > "$LANG_FILE" << EOF
$L
EOF
  else
    L=$(cat "$LANG_FILE")
  fi
}

###################################
### Checking the operating system
###################################
check_operating_system() {
  if [ -s /etc/os-release ]; then
    SYS="$(grep -i pretty_name /etc/os-release | cut -d \" -f2)"
  elif [ -x "$(type -p hostnamectl)" ]; then
    SYS="$(hostnamectl | grep -i system | cut -d : -f2)"
  elif [ -x "$(type -p lsb_release)" ]; then
    SYS="$(lsb_release -sd)"
  elif [ -s /etc/lsb-release ]; then
    SYS="$(grep -i description /etc/lsb-release | cut -d \" -f2)"
  elif [ -s /etc/redhat-release ]; then
    SYS="$(grep . /etc/redhat-release)"
  elif [ -s /etc/issue ]; then
    SYS="$(grep . /etc/issue | cut -d '\' -f1 | sed '/^[ ]*$/d')"
  fi

  REGEX=("debian" "ubuntu" "centos|red hat|kernel|alma|rocky")
  RELEASE=("Debian" "Ubuntu" "CentOS")
  EXCLUDE=("---")
  MAJOR=("10" "20" "7")
  PACKAGE_UPDATE=("apt -y update" "apt -y update" "yum -y update --skip-broken")
  PACKAGE_INSTALL=("apt -y install" "apt -y install" "yum -y install")
  PACKAGE_UNINSTALL=("apt -y autoremove" "apt -y autoremove" "yum -y autoremove")

  for int in "${!REGEX[@]}"; do
    [[ "${SYS,,}" =~ ${REGEX[int]} ]] && SYSTEM="${RELEASE[int]}" && break
  done

  if [ -z "$SYSTEM" ]; then
    [ -x "$(type -p yum)" ] && int=2 && SYSTEM='CentOS' || error " $(text 5) "
  fi

  MAJOR_VERSION=$(sed "s/[^0-9.]//g" <<< "$SYS" | cut -d. -f1)

  for ex in "${EXCLUDE[@]}"; do [[ ! "${SYS,,}" =~ $ex ]]; done &&
  [[ "$MAJOR_VERSION" -lt "${MAJOR[int]}" ]] && error " $(text 71) "
}

###################################
### Checking and installing dependencies
###################################
check_dependencies() {
  [ "${SYSTEM}" = 'CentOS' ] && ${PACKAGE_INSTALL[int]} vim-common epel-release
  DEPS_CHECK=("ping" "wget" "curl" "systemctl" "ip" "sudo")
  DEPS_INSTALL=("iputils-ping" "wget" "curl" "systemctl" "iproute2" "sudo")

  for g in "${!DEPS_CHECK[@]}"; do
    [ ! -x "$(type -p ${DEPS_CHECK[g]})" ] && [[ ! "${DEPS[@]}" =~ "${DEPS_INSTALL[g]}" ]] && DEPS+=(${DEPS_INSTALL[g]})
  done

  if [ "${#DEPS[@]}" -ge 1 ]; then
    info "\n $(text 72) ${DEPS[@]} \n"
    ${PACKAGE_UPDATE[int]}
    ${PACKAGE_INSTALL[int]} ${DEPS[@]}
  else
    info "\n $(text 73) \n"
  fi
}

###################################
### Root check
###################################
check_root() {
  if [[ $EUID -ne 0 ]]; then
    error " $(text 8) "
  fi
}

###################################
### Obtaining your external IP address
###################################
check_ip() {
  IP4_REGEX="^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$"
  IP4=$(ip route get 8.8.8.8 2>/dev/null | grep -Po -- 'src \K\S*')

  if [[ ! $IP4 =~ $IP4_REGEX ]]; then
      IP4=$(curl -s --max-time 5 ipinfo.io/ip 2>/dev/null)
  fi

  if [[ ! $IP4 =~ $IP4_REGEX ]]; then
    echo "Не удалось получить внешний IP."
    return 1
  fi
}

###################################
### Banner
###################################
banner_xray() {
  echo
  echo " █░█ █░░█ ░▀░ ░░ █▀▀█ █▀▀ ▀█░█▀ █▀▀ █▀▀█ █▀▀ █▀▀ ░░ █▀▀█ █▀▀█ █▀▀█ █░█ █░░█  "
  echo " ▄▀▄ █░░█ ▀█▀ ▀▀ █▄▄▀ █▀▀ ░█▄█░ █▀▀ █▄▄▀ ▀▀█ █▀▀ ▀▀ █░░█ █▄▄▀ █░░█ ▄▀▄ █▄▄█  "
  echo " ▀░▀ ░▀▀▀ ▀▀▀ ░░ ▀░▀▀ ▀▀▀ ░░▀░░ ▀▀▀ ▀░▀▀ ▀▀▀ ▀▀▀ ░░ █▀▀▀ ▀░▀▀ ▀▀▀▀ ▀░▀ ▄▄▄█  "
  echo
  echo
}

###################################
### Installation request
###################################
warning_banner() {
  warning " $(text 5) "
  echo
  info " $(text 6) "
  warning " apt-get update && apt-get full-upgrade -y && reboot "
}

###################################
### Cron rules
###################################
add_cron_rule() {
  local rule="$1"
  local logged_rule="${rule} >> ${DIR_REVERSE_PROXY}cron_jobs.log 2>&1"

  ( crontab -l | grep -Fxq "$logged_rule" ) || ( crontab -l 2>/dev/null; echo "$logged_rule" ) | crontab -
}

###################################
### Request and response from Cloudflare API
###################################
get_test_response() {
  testdomain=$(echo "${DOMAIN}" | rev | cut -d '.' -f 1-2 | rev)

  if [[ "$CFTOKEN" =~ [A-Z] ]]; then
    test_response=$(curl --silent --request GET --url https://api.cloudflare.com/client/v4/zones --header "Authorization: Bearer ${CFTOKEN}" --header "Content-Type: application/json")
  else
    test_response=$(curl --silent --request GET --url https://api.cloudflare.com/client/v4/zones --header "X-Auth-Key: ${CFTOKEN}" --header "X-Auth-Email: ${EMAIL}" --header "Content-Type: application/json")
  fi
}

###################################
### Function to clean the URL
###################################
clean_url() {
  local INPUT_URL_L="$1"
  local CLEANED_URL_L=$(echo "$INPUT_URL_L" | sed -E 's/^https?:\/\///' | sed -E 's/(:[0-9]+)?(\/[a-zA-Z0-9_\-\/]+)?$//')
  echo "$CLEANED_URL_L"
}

###################################
### Function to crop the domain to the last two parts
### CHANGED: теперь ничего не режем, возвращаем ровно то, что ввёл пользователь
###################################
crop_domain() {
  local DOMAIN_L=$1
  echo "$DOMAIN_L"
}

###################################
### Domain validation in cloudflare
###################################
check_cf_token() {
  while ! echo "$test_response" | grep -qE "\"${testdomain}\"|\"#dns_records:edit\"|\"#dns_records:read\"|\"#zone:read\""; do
    local TEMP_DOMAIN_L
    DOMAIN=""
    SUB_DOMAIN=""
    EMAIL=""
    CFTOKEN=""

    if [[ ${args[subdomain]} == "true" ]]; then
      reading " $(text 13) " TEMP_DOMAIN_L
      DOMAIN=$(clean_url "$TEMP_DOMAIN_L")
      echo
      reading " $(text 81) " TEMP_DOMAIN_L
      SUB_DOMAIN=$(clean_url "$TEMP_DOMAIN_L")
    else
      # CHANGED: без магии, домен = то, что ввёл пользователь,
      # SUB_DOMAIN такой же, чтобы не терять части вроде 'plex.'
      while [[ -z "$TEMP_DOMAIN_L" ]]; do
        reading " $(text 13) " TEMP_DOMAIN_L
        TEMP_DOMAIN_L=$(clean_url "$TEMP_DOMAIN_L")
      done

      DOMAIN="$TEMP_DOMAIN_L"
      SUB_DOMAIN="$TEMP_DOMAIN_L"
    fi

    echo

    while [[ -z $EMAIL ]]; do
      reading " $(text 15) " EMAIL
      echo
    done
    while [[ -z $CFTOKEN ]]; do
      reading " $(text 16) " CFTOKEN
    done

    get_test_response
    info " $(text 17) "
  done
}

###################################
### Processing paths with a loop
###################################
validate_path() {
  local VARIABLE_NAME="$1"
  local PATH_VALUE

  while true; do
    case "$VARIABLE_NAME" in
      METRICS)       reading " $(text 24) " PATH_VALUE ;;
      SHELLBOX)      reading " $(text 24) " PATH_VALUE ;;
      ADGUARDPATH)   reading " $(text 25) " PATH_VALUE ;;
      WEB_BASE_PATH) reading " $(text 26) " PATH_VALUE ;;
      SUB_PATH)      reading " $(text 27) " PATH_VALUE ;;
      SUB_JSON_PATH) reading " $(text 28) " PATH_VALUE ;;
    esac

    if [[ -z "$PATH_VALUE" ]]; then
      warning " $(text 29) "
      echo
    elif [[ $PATH_VALUE =~ ['{}\$/\\'] ]]; then
      warning " $(text 30) "
      echo
    else
      break
    fi
  done

  local ESCAPED_PATH=$(echo "$PATH_VALUE" | sed 's/ /\\ /g')

  case "$VARIABLE_NAME" in
    METRICS)       export METRICS="$ESCAPED_PATH" ;;
    SHELLBOX)      export SHELLBOX="$ESCAPED_PATH" ;;
    ADGUARDPATH)   export ADGUARDPATH="$ESCAPED_PATH" ;;
    WEB_BASE_PATH) export WEB_BASE_PATH="$ESCAPED_PATH" ;;
    SUB_PATH)      export SUB_PATH="$ESCAPED_PATH" ;;
    SUB_JSON_PATH) export SUB_JSON_PATH="$ESCAPED_PATH" ;;
  esac
}

###################################
### DNS Selection
###################################
choise_dns () {
  while true; do
    hint " $(text 31) \n" && reading " $(text 1) " CHOISE_DNS
    case $CHOISE_DNS in
      1)
        info " $(text 32) "
        break
        ;;
      2)
        info " $(text 25) "
        if [[ ${args[generate]} == "true" ]]; then
          ADGUARDPATH=$(eval ${generate[path]})
        else
          echo
          tilda "$(text 10)"
          validate_path ADGUARDPATH
        fi
        echo
        break
        ;;
      *)
        info " $(text 33) "
        ;;
    esac
  done
}

###################################
### Generating paths for cdn
###################################
generate_path_cdn() {
  CDNGRPC=$(eval ${generate[path]})
  CDNXHTTP=$(eval ${generate[path]})
  CDNHTTPU=$(eval ${generate[path]})
  CDNWS=$(eval ${generate[path]})
}

###################################
### Data entry
###################################
data_entry() {
  tilda "$(text 10)"

  reading " $(text 11) " USERNAME
  echo
  reading " $(text 12) " PASSWORD

  tilda "$(text 10)"

  [[ ${args[addu]} == "true" ]] && add_user

  check_cf_token

  tilda "$(text 10)"

  choise_dns

  generate_path_cdn

  if [[ ${args[generate]} == "true" ]]; then
    WEB_BASE_PATH=$(eval ${generate[path]})
    SUB_PATH=$(eval ${generate[path]})
    SUB_JSON_PATH=$(eval ${generate[path]})
  else
    echo
    validate_path WEB_BASE_PATH
    echo
    validate_path SUB_PATH
    echo
    validate_path SUB_JSON_PATH
  fi
  if [[ ${args[mon]} == "true" ]]; then
    if [[ ${args[generate]} == "true" ]]; then
      METRICS=$(eval ${generate[path]})
    else
      echo
      validate_path METRICS
    fi
  fi
  if [[ ${args[shell]} == "true" ]]; then
    if [[ ${args[generate]} == "true" ]]; then
      SHELLBOX=$(eval ${generate[path]})
    else
      echo
      validate_path SHELLBOX
    fi
  fi

  if [[ ${args[ssh]} == "true" ]]; then
    tilda "$(text 10)"
    reading " $(text 54) " ANSWER_SSH
    if [[ "${ANSWER_SSH,,}" == "y" ]]; then
      info " $(text 48) "
      out_data " $(text 49) "
      echo
      out_data " $(text 50) "
      out_data " $(text 51) "
      echo
      out_data " $(text 52)" "type \$env:USERPROFILE\.ssh\id_rsa.pub | ssh -p 22 ${USERNAME}@${IP4} \"cat >> ~/.ssh/authorized_keys\""
      out_data " $(text 53)" "ssh-copy-id -p 22 ${USERNAME}@${IP4}"
      echo
      while true; do
        if [[ -s "/home/${USERNAME}/.ssh/authorized_keys" || -s "/root/.ssh/authorized_keys" ]]; then
          info " $(text 56) "
          SSH_OK=true
          break
        else
          warning " $(text 55) "
          echo
          reading " $(text 54) " ANSWER_SSH
          if [[ "${ANSWER_SSH,,}" != "y" ]]; then
            warning " $(text 9) "
            SSH_OK=false
            break
          fi
        fi
      done
    else
      warning " $(text 9) "
      SSH_OK=false
    fi
  fi

  if [[ ${args[tgbot]} == "true" ]]; then
    tilda "$(text 10)"
    reading " $(text 35) " ADMIN_ID
    echo
    reading " $(text 34) " BOT_TOKEN
  fi
  tilda "$(text 10)"
}

###################################
### Install NGINX
###################################
nginx_gpg() {
  case "$SYSTEM" in
    Debian)
      ${PACKAGE_INSTALL[int]} debian-archive-keyring
      curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor \
        | tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null
      gpg --dry-run --quiet --no-keyring --import --import-options import-show /usr/share/keyrings/nginx-archive-keyring.gpg
      echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] \
      http://nginx.org/packages/debian `lsb_release -cs` nginx" \
        | tee /etc/apt/sources.list.d/nginx.list
      echo -e "Package: *\nPin: origin nginx.org\nPin: release o=nginx\nPin-Priority: 900\n" \
        | tee /etc/apt/preferences.d/99nginx
      ;;

    Ubuntu)
      ${PACKAGE_INSTALL[int]} ubuntu-keyring
      curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor \
        | tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null
      gpg --dry-run --quiet --no-keyring --import --import-options import-show /usr/share/keyrings/nginx-archive-keyring.gpg
      echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] \
      http://nginx.org/packages/ubuntu `lsb_release -cs` nginx" \
        | tee /etc/apt/sources.list.d/nginx.list
      echo -e "Package: *\nPin: origin nginx.org\nPin: release o=nginx\nPin-Priority: 900\n" \
        | tee /etc/apt/preferences.d/99nginx
      ;;

    CentOS|Fedora)
      ${PACKAGE_INSTALL[int]} yum-utils
      cat <<EOL > /etc/yum.repos.d/nginx.repo
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/\$releasever/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true

[nginx-mainline]
name=nginx mainline repo
baseurl=http://nginx.org/packages/mainline/centos/\$releasever/\$basearch/
gpgcheck=1
enabled=0
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOL
      ;;
  esac
  ${PACKAGE_UPDATE[int]}
  ${PACKAGE_INSTALL[int]} nginx
  systemctl daemon-reload
  systemctl start nginx
  systemctl enable nginx
  systemctl restart nginx
  systemctl status nginx --no-pager
}

###################################
### Installing packages
###################################
installation_of_utilities() {
  info " $(text 36) "
  case "$SYSTEM" in
    Debian|Ubuntu)
      DEPS_PACK_CHECK=("jq" "ufw" "zip" "wget" "gpg" "nano" "cron" "sqlite3" "certbot" "vnstat" "openssl" "netstat" "htpasswd" "update-ca-certificates" "add-apt-repository" "unattended-upgrades" "certbot-dns-cloudflare")
      DEPS_PACK_INSTALL=("jq" "ufw" "zip" "wget" "gnupg2" "nano" "cron" "sqlite3" "certbot" "vnstat" "openssl" "net-tools" "apache2-utils" "ca-certificates" "software-properties-common" "unattended-upgrades" "python3-certbot-dns-cloudflare")

      for g in "${!DEPS_PACK_CHECK[@]}"; do
        [ ! -x "$(type -p ${DEPS_PACK_CHECK[g]})" ] && [[ ! "${DEPS_PACK[@]}" =~ "${DEPS_PACK_INSTALL[g]}" ]] && DEPS_PACK+=(${DEPS_PACK_INSTALL[g]})
      done

      if [ "${#DEPS_PACK[@]}" -ge 1 ]; then
        info " $(text 77) ": ${DEPS_PACK[@]}
        ${PACKAGE_UPDATE[int]}
        ${PACKAGE_INSTALL[int]} ${DEPS_PACK[@]}
      else
        info " $(text 78) "
      fi
      ;;

    CentOS|Fedora)
      DEPS_PACK_CHECK=("jq" "zip" "tar" "wget" "gpg" "nano" "crontab" "sqlite3" "openssl" "netstat" "nslookup" "htpasswd" "certbot" "update-ca-certificates" "certbot-dns-cloudflare")
      DEPS_PACK_INSTALL=("jq" "zip" "tar" "wget" "gnupg2" "nano" "cronie" "sqlite" "openssl" "net-tools" "bind-utils" "httpd-tools" "certbot" "ca-certificates" "python3-certbot-dns-cloudflare")

      for g in "${!DEPS_PACK_CHECK[@]}"; do
        [ ! -x "$(type -p ${DEPS_PACK_CHECK[g]})" ] && [[ ! "${DEPS_PACK[@]}" =~ "${DEPS_PACK_INSTALL[g]}" ]] && DEPS_PACK+=(${DEPS_PACK_INSTALL[g]})
      done

      if [ "${#DEPS_PACK[@]}" -ge 1 ]; then
        info " $(text 77) ": ${DEPS_PACK[@]}
        ${PACKAGE_UPDATE[int]}
        ${PACKAGE_INSTALL[int]} ${DEPS_PACK[@]}
      else
        info " $(text 78) "
      fi
      ;;
  esac

  nginx_gpg
  ${PACKAGE_INSTALL[int]} systemd-resolved
  tilda "$(text 10)"
}

###################################
### DNS Systemd-resolved
###################################
dns_systemd_resolved() {
  tee /etc/systemd/resolved.conf <<EOF
[Resolve]
DNS=1.1.1.1 8.8.8.8 8.8.4.4
#FallbackDNS=
Domains=~.
DNSSEC=yes
DNSOverTLS=yes
EOF
  systemctl restart systemd-resolved.service
}

###################################
### DNS Adguardhome
###################################
dns_adguard_home() {
  rm -rf AdGuardHome_*
  while ! wget -q --progress=dot:mega --timeout=30 --tries=10 --retry-connrefused https://static.adguard.com/adguardhome/release/AdGuardHome_linux_amd64.tar.gz; do
    warning " $(text 38) "
    sleep 3
  done
  tar -zxvf AdGuardHome_linux_amd64.tar.gz

  AdGuardHome/AdGuardHome -s install
  HASH=$(htpasswd -B -C 10 -n -b ${USERNAME} ${PASSWORD} | cut -d ":" -f 2)

  rm -f AdGuardHome/AdGuardHome.yaml
  while ! wget -q --progress=dot:mega --timeout=30 --tries=10 --retry-connrefused "https://github.com/cortez24rus/xui-reverse-proxy/raw/refs/heads/main/adh/AdGuardHome.yaml" -O AdGuardHome/AdGuardHome.yaml; do
    warning " $(text 38) "
    sleep 3
  done

  sleep 1
  sed -i \
    -e "s|username|${USERNAME}|g" \
    -e "s|hash|${HASH}|g" \
    AdGuardHome/AdGuardHome.yaml

  AdGuardHome/AdGuardHome -s restart
}

###################################
### Dns systemd for adguard
###################################
dns_systemd_resolved_for_adguard() {
  tee /etc/systemd/resolved.conf <<EOF
[Resolve]
DNS=127.0.0.1
#FallbackDNS=
#Domains=
#DNSSEC=no
DNSOverTLS=no
DNSStubListener=no
EOF
  systemctl restart systemd-resolved.service
}

###################################
### DNS menu
###################################
dns_encryption() {
  info " $(text 37) "
  dns_systemd_resolved
  case $CHOISE_DNS in
    1)
      COMMENT_AGH=""
      tilda "$(text 10)"
      ;;

    2)
      mkdir -p /etc/nginx/locations/

      cat > /etc/nginx/locations/adguard.conf <<EOF
location /${ADGUARDPATH}/ {
  if (\$hack = 1) {return 404;}
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header Range \$http_range;
  proxy_set_header If-Range \$http_if_range;
  proxy_redirect /login.html /${ADGUARDPATH}/login.html;
  proxy_pass http://127.0.0.1:8081/;
  break;
}
EOF
      dns_adguard_home
      dns_systemd_resolved_for_adguard
      tilda "$(text 10)"
      ;;

    *)
      warning " $(text 33)"
      dns_encryption
      ;;
  esac
}

###################################
### Creating a user
###################################
add_user() {
  info " $(text 39) "

  case "$SYSTEM" in
    Debian|Ubuntu)
      useradd -m -s $(which bash) -G sudo ${USERNAME}
      ;;

    CentOS|Fedora)
      useradd -m -s $(which bash) -G wheel ${USERNAME}
      ;;
  esac
  echo "${USERNAME}:${PASSWORD}" | chpasswd
  mkdir -p /home/${USERNAME}/.ssh/
  touch /home/${USERNAME}/.ssh/authorized_keys
  chown -R ${USERNAME}: /home/${USERNAME}/.ssh
  chmod -R 700 /home/${USERNAME}/.ssh

  tilda "$(text 10)"
}

###################################
### Automatic system update
###################################
setup_auto_updates() {
  info " $(text 40) "

  case "$SYSTEM" in
    Debian|Ubuntu)
      echo 'Unattended-Upgrade::Mail "root";' >> /etc/apt/apt.conf.d/50unattended-upgrades
      echo unattended-upgrades unattended-upgrades/enable_auto_updates boolean true | debconf-set-selections
      dpkg-reconfigure -f noninteractive unattended-upgrades
      systemctl restart unattended-upgrades
      ;;

    CentOS|Fedora)
      cat > /etc/dnf/automatic.conf <<EOF
[commands]
upgrade_type = security
random_sleep = 0
download_updates = yes
apply_updates = yes

[email]
email_from = root@localhost
email_to = root
email_host = localhost
EOF
      systemctl enable --now dnf-automatic.timer
      systemctl status dnf-automatic.timer
      ;;
  esac

  tilda "$(text 10)"
}

###################################
### BBR
###################################
enable_bbr() {
  info " $(text 41) "

  if ! grep -q "net.core.default_qdisc = fq" /etc/sysctl.conf; then
      echo "net.core.default_qdisc = fq" >> /etc/sysctl.conf
  fi
  if ! grep -q "net.ipv4.tcp_congestion_control = bbr" /etc/sysctl.conf; then
      echo "net.ipv4.tcp_congestion_control = bbr" >> /etc/sysctl.conf
  fi

  sysctl -p
}

###################################
### Disable IPv6
###################################
disable_ipv6() {
  info " $(text 42) "
  interface_name=$(ifconfig -s | awk 'NR==2 {print $1}')

  if ! grep -q "net.ipv6.conf.all.disable_ipv6 = 1" /etc/sysctl.conf; then
      echo "net.ipv6.conf.all.disable_ipv6 = 1" >> /etc/sysctl.conf
  fi
  if ! grep -q "net.ipv6.conf.default.disable_ipv6 = 1" /etc/sysctl.conf; then
      echo "net.ipv6.conf.default.disable_ipv6 = 1" >> /etc/sysctl.conf
  fi
  if ! grep -q "net.ipv6.conf.lo.disable_ipv6 = 1" /etc/sysctl.conf; then
      echo "net.ipv6.conf.lo.disable_ipv6 = 1" >> /etc/sysctl.conf
  fi
  if ! grep -q "net.ipv6.conf.$interface_name.disable_ipv6 = 1" /etc/sysctl.conf; then
      echo "net.ipv6.conf.$interface_name.disable_ipv6 = 1" >> /etc/sysctl.conf
  fi

  sysctl -p
  tilda "$(text 10)"
}

###################################
### Enable IPv6
###################################
enable_ipv6() {
  info " $(text 42) "
  interface_name=$(ifconfig -s | awk 'NR==2 {print $1}')

  sed -i "/net.ipv6.conf.all.disable_ipv6 = 1/d" /etc/sysctl.conf
  sed -i "/net.ipv6.conf.default.disable_ipv6 = 1/d" /etc/sysctl.conf
  sed -i "/net.ipv6.conf.lo.disable_ipv6 = 1/d" /etc/sysctl.conf
  sed -i "/net.ipv6.conf.$interface_name.disable_ipv6 = 1/d" /etc/sysctl.conf

  echo -e "IPv6 включен"
  sysctl -p
  tilda "$(text 10)"
}

###################################
### Swapfile
###################################
swapfile() {
  echo
  echo "Setting up swapfile and restarting the WARP service if necessary"
  swapoff /swapfile*
  dd if=/dev/zero of=/swapfile bs=1M count=512
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  swapon --show

  cat > ${DIR_REVERSE_PROXY}restart_warp.sh <<EOF
#!/bin/bash
SWAP_USED=\$(free -m | grep Swap | awk '{print \$3}')
if [ "\$SW
