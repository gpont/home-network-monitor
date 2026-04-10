// frontend/src/lib/i18n/ru.ts
const ru = {
  // ── UI strings ───────────────────────────────────────────
  'ui.live':             'Live',
  'ui.reconnecting':     'Переподключение...',
  'ui.updated':          'Обновлено {n}с назад',
  'ui.loading':          'Загрузка...',
  'ui.what_to_do':       'Что делать:',
  'ui.cascade_warning':  'Вероятно каскадная ошибка от вышестоящего слоя',
  'ui.legend_ok':        'OK — проверка пройдена',
  'ui.legend_fail':      'Ошибка — требует внимания',
  'ui.legend_warn':      'Предупреждение',
  'ui.legend_info':      'Информация (без критериев)',
  'ui.legend_nodata':    'Нет данных',
  'ui.badge_errors':     '{n} ошибок',
  'ui.badge_ok':         '{ok}/{total} ✓',
  'ui.stale':            'данные устарели',
  'ui.no_data':          'данные пока не получены',

  // ── Layers ────────────────────────────────────────────────
  'layer.1.name': 'Устройство / Интерфейс',
  'layer.2.name': 'Шлюз / Локальная сеть',
  'layer.3.name': 'Провайдер / WAN',
  'layer.4.name': 'Интернет (L3)',
  'layer.5.name': 'DNS',
  'layer.6.name': 'HTTP / Приложения',
  'layer.7.name': 'Безопасность / Расширенные',

  // ── Checks — Layer 1: Device / Interface ─────────────────
  'check.iface_up.name':     'Интерфейс активен',
  'check.iface_up.hint':     'Сетевой кабель подключён и интерфейс работает. Если DOWN — устройство физически отключено от сети.',
  'check.iface_up.nodata':   'Недоступно внутри Docker с bridge-сетью. Работает при network_mode: host на Linux.',
  'check.iface_up.fix.0':    'Проверь кабель или WiFi',
  'check.iface_up.fix.1':    'Перезапусти сетевой адаптер',
  'check.iface_up.fix.2':    'Проверь статус интерфейса: ip link show',

  'check.iface_ipv4.name':   'IPv4 адрес',
  'check.iface_ipv4.hint':   'Устройству назначен IP-адрес в локальной сети. Без него — устройство невидимо для роутера.',
  'check.iface_ipv4.nodata': 'Недоступно внутри Docker с bridge-сетью. Работает при network_mode: host на Linux.',
  'check.iface_ipv4.fix.0':  'Проверь DHCP сервер на роутере',
  'check.iface_ipv4.fix.1':  'Попробуй: dhclient eth0',
  'check.iface_ipv4.fix.2':  'Перезапусти сетевой интерфейс',

  'check.iface_gateway.name':   'Default gateway',
  'check.iface_gateway.hint':   'Роутер задан как выход в интернет. Без шлюза — трафик некуда отправлять.',
  'check.iface_gateway.nodata': 'Недоступно внутри Docker с bridge-сетью. Работает при network_mode: host на Linux.',
  'check.iface_gateway.fix.0':  'Проверь настройки роутера',
  'check.iface_gateway.fix.1':  'Добавь маршрут: ip route add default via <gateway>',

  'check.iface_dhcp.name':   'DHCP lease',
  'check.iface_dhcp.hint':   'Как устройство получило IP: автоматически (DHCP), через PPPoE или вручную.',
  'check.iface_dhcp.fix.0':  'Проверь настройки сети',
  'check.iface_dhcp.fix.1':  'Убедись что DHCP включён на роутере',

  'check.iface_errors.name':   'Нет ошибок интерфейса',
  'check.iface_errors.hint':   'rx_errors + tx_errors = 0. Ненулевые счётчики — признак проблем с кабелем или портом.',
  'check.iface_errors.fix.0':  'Проверь кабель/соединение',
  'check.iface_errors.fix.1':  'Смотри: ethtool eth0',

  'check.iface_drops.name':   'Нет дропов пакетов',
  'check.iface_drops.hint':   'rx_dropped + tx_dropped = 0. Дропы указывают на перегрузку буферов.',
  'check.iface_drops.fix.0':  'Возможна перегрузка сети',
  'check.iface_drops.fix.1':  'Проверь буферы сетевой карты',

  'check.iface_ipv6_ll.name':   'IPv6 link-local',
  'check.iface_ipv6_ll.hint':   'IPv6 link-local адрес (fe80::) назначен. Нужен для работы IPv6.',
  'check.iface_ipv6_ll.fix.0':  'IPv6 может быть отключён на интерфейсе',
  'check.iface_ipv6_ll.fix.1':  'Проверь: sysctl net.ipv6.conf.all.disable_ipv6',

  'check.iface_arp.name':   'ARP запись шлюза',
  'check.iface_arp.hint':   'MAC-адрес шлюза есть в ARP таблице — роутер видит устройство на уровне L2.',
  'check.iface_arp.fix.0':  'Шлюз не отвечает на ARP',
  'check.iface_arp.fix.1':  'Проверь: arp -n',
  'check.iface_arp.fix.2':  'Возможна проблема в локальной сети',

  // ── Checks — Layer 2: Gateway / Local ────────────────────
  'check.gw_ping.name':   'Ping шлюза',
  'check.gw_ping.hint':   'ICMP ping до роутера — RTT < 5ms. Базовая проверка доступности роутера.',
  'check.gw_ping.fix.0':  'Роутер недоступен',
  'check.gw_ping.fix.1':  'Проверь кабель между сервером и роутером',
  'check.gw_ping.fix.2':  'Перезагрузи роутер',

  'check.gw_ping_loss.name':   'Стабильность к шлюзу',
  'check.gw_ping_loss.hint':   'Потери пакетов до роутера < 1% за 15 мин. Показывает стабильность локальной сети.',
  'check.gw_ping_loss.fix.0':  'Нестабильная локальная сеть',
  'check.gw_ping_loss.fix.1':  'Проверь кабель/WiFi сигнал',
  'check.gw_ping_loss.fix.2':  'Проверь не перегружен ли роутер',

  'check.gw_dns.name':   'DNS роутера',
  'check.gw_dns.hint':   'DNS сервер роутера отвечает < 100ms. Если нет — устройства за роутером не смогут резолвить домены.',
  'check.gw_dns.fix.0':  'DNS роутера не отвечает',
  'check.gw_dns.fix.1':  'Перезагрузи роутер',
  'check.gw_dns.fix.2':  'Временно используй 8.8.8.8 в /etc/resolv.conf',

  'check.gw_mtu.name':   'MTU локальной сети',
  'check.gw_mtu.hint':   'Нет фрагментации пакетов 1500 байт. Фрагментация замедляет соединение.',
  'check.gw_mtu.fix.0':  'Проблема MTU — фрагментация',
  'check.gw_mtu.fix.1':  'Проверь настройки MTU на роутере',
  'check.gw_mtu.fix.2':  'Попробуй уменьшить MTU до 1492 (PPPoE)',

  'check.gw_jitter.name':   'Jitter до шлюза',
  'check.gw_jitter.hint':   'Нестабильность RTT до роутера < 5ms. Высокий jitter = нестабильное соединение.',
  'check.gw_jitter.fix.0':  'Нестабильный WiFi или кабель',
  'check.gw_jitter.fix.1':  'Попробуй другой порт на роутере',
  'check.gw_jitter.fix.2':  'Уменьши нагрузку на сеть',

  'check.iface_speed.name': 'Скорость интерфейса',
  'check.iface_speed.hint': 'Информация об интерфейсе (информационный чек).',

  // ── Checks — Layer 3: ISP / WAN ──────────────────────────
  'check.isp_hop.name': 'ISP первый хоп',
  'check.isp_hop.hint': 'Первый хоп провайдера в traceroute доступен.',

  'check.isp_hop_rtt.name':   'RTT до ISP хопа',
  'check.isp_hop_rtt.hint':   'Задержка до первого хопа провайдера < 20ms.',
  'check.isp_hop_rtt.fix.0':  'Высокая задержка у провайдера',
  'check.isp_hop_rtt.fix.1':  'Свяжись с провайдером',
  'check.isp_hop_rtt.fix.2':  'Проверь качество линии',

  'check.wan_type.name': 'Тип WAN',
  'check.wan_type.hint': 'Тип подключения к провайдеру определён.',

  'check.cgnat.name':   'Нет CGNAT',
  'check.cgnat.hint':   'Публичный IP — не за CGNAT провайдера. CGNAT блокирует port forwarding.',
  'check.cgnat.fix.0':  'Ты за CGNAT провайдера',
  'check.cgnat.fix.1':  'Port forwarding не будет работать',
  'check.cgnat.fix.2':  'Запроси у провайдера выделенный IP',

  'check.public_ip.name':   'Публичный IP',
  'check.public_ip.hint':   'Публичный IPv4 адрес получен.',
  'check.public_ip.fix.0':  'Публичный IP не определён',
  'check.public_ip.fix.1':  'Проверь интернет-подключение',
  'check.public_ip.fix.2':  'Проверь настройки роутера',

  'check.route_stable.name':   'Маршрут стабилен',
  'check.route_stable.hint':   'Маршрут трассировки не изменился с последней проверки.',
  'check.route_stable.fix.0':  'Маршрут изменился',
  'check.route_stable.fix.1':  'Возможно переключение у провайдера',
  'check.route_stable.fix.2':  'Наблюдай за стабильностью',

  'check.isp_dns.name': 'DNS провайдера',
  'check.isp_dns.hint': 'Информация о DNS провайдера.',

  // ── Checks — Layer 4: Internet (L3) ──────────────────────
  'check.ping_8888.name':   'Ping 8.8.8.8',
  'check.ping_8888.hint':   'ICMP ping до Google DNS — RTT < 50ms. Базовая проверка интернета.',
  'check.ping_8888.fix.0':  'Нет связи с интернетом',
  'check.ping_8888.fix.1':  'Проверь кабель провайдера',
  'check.ping_8888.fix.2':  'Перезагрузи роутер',

  'check.ping_1111.name':   'Ping 1.1.1.1',
  'check.ping_1111.hint':   'ICMP ping до Cloudflare DNS — RTT < 50ms.',
  'check.ping_1111.fix.0':  'Нет связи с интернетом (Cloudflare)',
  'check.ping_1111.fix.1':  'Проверь интернет-подключение',

  'check.ping_9999.name':   'Ping 9.9.9.9',
  'check.ping_9999.hint':   'ICMP ping до Quad9 DNS — RTT < 100ms.',
  'check.ping_9999.fix.0':  'Нет связи с Quad9',
  'check.ping_9999.fix.1':  'Проверь интернет-подключение',

  'check.tcp_443.name':   'TCP connect 443',
  'check.tcp_443.hint':   'TCP соединение к 1.1.1.1:443 успешно. Проверяет что HTTPS трафик не заблокирован.',
  'check.tcp_443.fix.0':  'TCP порт 443 недоступен',
  'check.tcp_443.fix.1':  'Возможна блокировка фаерволом',
  'check.tcp_443.fix.2':  'Проверь настройки роутера',

  'check.pkt_loss.name':   'Packet loss',
  'check.pkt_loss.hint':   'Потери пакетов < 1% за 15 минут.',
  'check.pkt_loss.fix.0':  'Нестабильное соединение',
  'check.pkt_loss.fix.1':  'Проверь кабель провайдера',
  'check.pkt_loss.fix.2':  'Свяжись с провайдером',

  'check.jitter.name':   'Jitter (нестабильность)',
  'check.jitter.hint':   'Нестабильность RTT до интернета < 10ms.',
  'check.jitter.fix.0':  'Нестабильный интернет',
  'check.jitter.fix.1':  'Проверь качество линии провайдера',
  'check.jitter.fix.2':  'Смотри: mtr 8.8.8.8',

  'check.no_blackhole.name':   'Нет black hole',
  'check.no_blackhole.hint':   'В traceroute нет 3+ подряд пропущенных хопов.',
  'check.no_blackhole.fix.0':  'Обнаружен black hole в сети',
  'check.no_blackhole.fix.1':  'Возможна фильтрация ICMP провайдером',
  'check.no_blackhole.fix.2':  'Проверь traceroute вручную',

  // ── Checks — Layer 5: DNS ────────────────────────────────
  'check.dns_gw.name':   'DNS роутера резолвит',
  'check.dns_gw.hint':   'DNS сервер роутера возвращает корректный ответ.',
  'check.dns_gw.fix.0':  'DNS роутера сломан',
  'check.dns_gw.fix.1':  'Перезагрузи роутер',
  'check.dns_gw.fix.2':  'Временно поменяй DNS на 8.8.8.8',

  'check.dns_8888.name':   'DNS 8.8.8.8',
  'check.dns_8888.hint':   'Google Public DNS отвечает корректно.',
  'check.dns_8888.fix.0':  'DNS 8.8.8.8 недоступен',
  'check.dns_8888.fix.1':  'Проблема с интернетом или блокировка',

  'check.dns_1111.name':   'DNS 1.1.1.1',
  'check.dns_1111.hint':   'Cloudflare DNS отвечает корректно.',
  'check.dns_1111.fix.0':  'DNS 1.1.1.1 недоступен',
  'check.dns_1111.fix.1':  'Проблема с интернетом или блокировка',

  'check.dns_latency.name':   'DNS задержка',
  'check.dns_latency.hint':   'Задержка DNS запросов < 100ms.',
  'check.dns_latency.fix.0':  'Высокая задержка DNS',
  'check.dns_latency.fix.1':  'Используй более быстрый DNS сервер',
  'check.dns_latency.fix.2':  'Проверь нагрузку на сеть',

  'check.dns_consistency.name':   'DNS согласованность',
  'check.dns_consistency.hint':   'Все DNS серверы возвращают одинаковые ответы.',
  'check.dns_consistency.fix.0':  'DNS серверы дают разные ответы',
  'check.dns_consistency.fix.1':  'Возможен DNS hijacking или проблема с кешем',
  'check.dns_consistency.fix.2':  'Проверь настройки DNS роутера',

  'check.nxdomain.name':   'NXDOMAIN корректен',
  'check.nxdomain.hint':   'DNS возвращает NXDOMAIN для несуществующих доменов.',
  'check.nxdomain.fix.0':  'DNS не возвращает NXDOMAIN',
  'check.nxdomain.fix.1':  'Роутер или провайдер перехватывает DNS запросы',
  'check.nxdomain.fix.2':  'Используй DNS через DoH',

  'check.dns_hijack.name':   'DNS не перехвачен',
  'check.dns_hijack.hint':   'Нет DNS hijacking — ответы не подменяются.',
  'check.dns_hijack.fix.0':  'Обнаружен DNS hijacking',
  'check.dns_hijack.fix.1':  'DNS запросы перехватываются',
  'check.dns_hijack.fix.2':  'Используй DNS-over-HTTPS или VPN',

  'check.doh.name':   'DNS over HTTPS',
  'check.doh.hint':   'DoH через cloudflare-dns.com работает.',
  'check.doh.fix.0':  'DoH недоступен',
  'check.doh.fix.1':  'HTTPS к cloudflare-dns.com заблокирован',
  'check.doh.fix.2':  'Проверь фаервол и блокировки',

  // ── Checks — Layer 6: HTTP / Application ─────────────────
  'check.http_google.name':   'HTTP google.com',
  'check.http_google.hint':   'HTTPS до google.com — ответ 200, < 2s.',
  'check.http_google.fix.0':  'google.com недоступен',
  'check.http_google.fix.1':  'Проверь интернет и DNS',
  'check.http_google.fix.2':  'Возможна блокировка',

  'check.http_cf.name':   'HTTP cloudflare.com',
  'check.http_cf.hint':   'HTTPS до cloudflare.com — ответ 200.',
  'check.http_cf.fix.0':  'cloudflare.com недоступен',
  'check.http_cf.fix.1':  'Проверь интернет-подключение',

  'check.http_github.name':   'HTTP github.com',
  'check.http_github.hint':   'HTTPS до github.com — ответ 200.',
  'check.http_github.fix.0':  'github.com недоступен',
  'check.http_github.fix.1':  'Проверь интернет-подключение',

  'check.http_redirect.name':   'HTTP redirect → HTTPS',
  'check.http_redirect.hint':   'HTTP перенаправляет на HTTPS. Если нет — возможен перехват трафика.',
  'check.http_redirect.fix.0':  'HTTP трафик перехватывается',
  'check.http_redirect.fix.1':  'Возможен captive portal или прокси',
  'check.http_redirect.fix.2':  'Проверь настройки сети',

  'check.http_ipv6.name': 'IPv6 HTTP',
  'check.http_ipv6.hint': 'HTTPS через IPv6 (если доступен).',

  'check.speedtest.name': 'Speedtest',
  'check.speedtest.hint': 'Скорость загрузки/выгрузки.',

  'check.captive_portal.name':   'Captive portal',
  'check.captive_portal.hint':   'Нет captive portal — сеть открытая.',
  'check.captive_portal.fix.0':  'Обнаружен captive portal',
  'check.captive_portal.fix.1':  'Открой браузер и пройди авторизацию',
  'check.captive_portal.fix.2':  'Проверь нет ли прокси-сервера',

  // ── Checks — Layer 7: Security / Advanced ────────────────
  'check.ssl.name':   'SSL сертификаты',
  'check.ssl.hint':   'Все SSL сертификаты действительны > 30 дней.',
  'check.ssl.fix.0':  'SSL сертификат истекает',
  'check.ssl.fix.1':  'Обнови сертификат',
  'check.ssl.fix.2':  "Проверь Let's Encrypt автообновление",

  'check.tls_ver.name': 'TLS версия',
  'check.tls_ver.hint': 'TLS ≥ 1.2 на всех хостах.',

  'check.path_mtu.name':   'Path MTU',
  'check.path_mtu.hint':   'Нет фрагментации пакетов до интернета.',
  'check.path_mtu.fix.0':  'MTU проблема',
  'check.path_mtu.fix.1':  'Уменьши MTU до 1492 (PPPoE) или 1480 (tunnel)',
  'check.path_mtu.fix.2':  'Проверь настройки роутера',

  'check.ipv6_global.name':   'IPv6 глобальный',
  'check.ipv6_global.hint':   'Глобальное IPv6 подключение работает.',
  'check.ipv6_global.fix.0':  'IPv6 недоступен',
  'check.ipv6_global.fix.1':  'Узнай у провайдера поддержку IPv6',
  'check.ipv6_global.fix.2':  'Настрой IPv6 tunnel (6in4)',

  'check.ntp.name':   'NTP синхронизация',
  'check.ntp.hint':   'Системное время синхронизировано — drift < 5s.',
  'check.ntp.fix.0':  'NTP не синхронизирован',
  'check.ntp.fix.1':  'Проверь: systemctl status systemd-timesyncd',
  'check.ntp.fix.2':  'Или: ntpdate pool.ntp.org',

  'check.ip_stable.name':   'IP не меняется',
  'check.ip_stable.hint':   'Публичный IP стабилен последние 24 часа.',
  'check.ip_stable.fix.0':  'Публичный IP изменился',
  'check.ip_stable.fix.1':  'Динамический IP — нормально для домашней сети',
  'check.ip_stable.fix.2':  'Рассмотри DDNS если нужен стабильный адрес',

  'check.route_stable_sec.name':   'Routing стабилен',
  'check.route_stable_sec.hint':   'Маршрут трассировки не менялся.',
  'check.route_stable_sec.fix.0':  'Маршрут изменился',
  'check.route_stable_sec.fix.1':  'Возможны технические работы у провайдера',

  'check.os_resolver.name':   'OS резолвер',
  'check.os_resolver.hint':   '/etc/resolv.conf содержит nameserver.',
  'check.os_resolver.fix.0':  '/etc/resolv.conf пустой или отсутствует',
  'check.os_resolver.fix.1':  'Добавь: nameserver 8.8.8.8',
  'check.os_resolver.fix.2':  'Проверь сетевые настройки системы',

  'check.dns_leak.name':   'DNS leak',
  'check.dns_leak.hint':   'DNS запросы не утекают через посторонние серверы.',
  'check.dns_leak.fix.0':  'Обнаружена утечка DNS',
  'check.dns_leak.fix.1':  'DNS запросы идут через неожиданный сервер',
  'check.dns_leak.fix.2':  'Используй VPN с DNS leak protection',

  'check.iface_anomaly.name':   'Аномалии интерфейса',
  'check.iface_anomaly.hint':   'Нет резкого роста ошибок/дропов.',
  'check.iface_anomaly.fix.0':  'Аномалии в статистике интерфейса',
  'check.iface_anomaly.fix.1':  'Проверь физическое соединение',
  'check.iface_anomaly.fix.2':  'Смотри: ip -s link show',

  // ── Diagnostic rules ────────────────────────────────────
  'diag.R1.title':   'Полный обрыв сети',
  'diag.R1.desc':    'Нет связи ни с роутером, ни с интернетом',
  'diag.R1.step.0':  'Проверь кабель питания роутера',
  'diag.R1.step.1':  'Проверь кабель между сервером и роутером',
  'diag.R1.step.2':  'Перезагрузи роутер',
  'diag.R1.step.3':  'Проверь статус интерфейса: ip link show',

  'diag.R2.title':   'Роутер недоступен',
  'diag.R2.desc':    'Интерфейс поднят, но роутер не отвечает на ping и ARP',
  'diag.R2.step.0':  'Проверь кабель между сервером и роутером',
  'diag.R2.step.1':  'Убедись что роутер включён',
  'diag.R2.step.2':  'Попробуй: arp -n',
  'diag.R2.step.3':  'Перезагрузи роутер',

  'diag.R3.title':   'Нет интернета — проблема у провайдера',
  'diag.R3.desc':    'Роутер доступен, но интернет недоступен',
  'diag.R3.step.0':  'Позвони провайдеру',
  'diag.R3.step.1':  'Проверь статус оборудования провайдера',
  'diag.R3.step.2':  'Попробуй перезагрузить роутер',
  'diag.R3.step.3':  'Проверь баланс на счёте',

  'diag.R4.title':   'DNS не работает, IP-связь есть',
  'diag.R4.desc':    'Ping и TCP работают, но все DNS серверы не отвечают',
  'diag.R4.step.0':  "Временно поменяй DNS: echo 'nameserver 8.8.8.8' > /etc/resolv.conf",
  'diag.R4.step.1':  'Перезагрузи роутер',
  'diag.R4.step.2':  'Проверь настройки DNS на роутере',

  'diag.R5.title':   'DNS роутера сломан, внешние работают',
  'diag.R5.desc':    'DNS роутера не отвечает, 8.8.8.8 работает',
  'diag.R5.step.0':  'Перезагрузи роутер',
  'diag.R5.step.1':  'Измени DNS на роутере на 8.8.8.8',
  'diag.R5.step.2':  'Временно используй внешний DNS',

  'diag.R6.title':   'DNS hijacking — перехват запросов',
  'diag.R6.desc':    'DNS запросы перехватываются или NXDOMAIN не работает',
  'diag.R6.step.0':  'Используй DNS-over-HTTPS',
  'diag.R6.step.1':  'Включи DoH в браузере',
  'diag.R6.step.2':  'Рассмотри использование VPN',
  'diag.R6.step.3':  'Проверь настройки роутера',

  'diag.R7.title':   'Нестабильное соединение — потери пакетов',
  'diag.R7.desc':    'Packet loss > 5% за последние 15 минут',
  'diag.R7.step.0':  'Проверь кабель провайдера',
  'diag.R7.step.1':  'Свяжись с провайдером',
  'diag.R7.step.2':  'Проверь качество WiFi сигнала',
  'diag.R7.step.3':  'Смотри: mtr 8.8.8.8',

  'diag.R8.title':   'Проблема MTU — фрагментация',
  'diag.R8.desc':    'Обнаружена фрагментация пакетов',
  'diag.R8.step.0':  'Уменьши MTU до 1492 (PPPoE)',
  'diag.R8.step.1':  'Уменьши MTU до 1480 (tunnel)',
  'diag.R8.step.2':  'Проверь настройки MTU на роутере',
  'diag.R8.step.3':  'Команда: ip link set eth0 mtu 1492',

  'diag.R9.title':   'CGNAT — ты за NAT провайдера',
  'diag.R9.desc':    'Твой публичный IP принадлежит провайдеру (100.64.0.0/10)',
  'diag.R9.step.0':  'Port forwarding не будет работать',
  'diag.R9.step.1':  'Запроси у провайдера выделенный IP',
  'diag.R9.step.2':  'Рассмотри VPN с port forwarding',

  'diag.R10.title':   'HTTP заблокирован',
  'diag.R10.desc':    'Ping и DNS работают, но HTTP/HTTPS заблокирован',
  'diag.R10.step.0':  'Проверь настройки фаервола',
  'diag.R10.step.1':  'Попробуй другой браузер',
  'diag.R10.step.2':  'Возможна блокировка провайдером',
  'diag.R10.step.3':  'Рассмотри использование VPN',

  'diag.R11.title':   'IPv6 не работает',
  'diag.R11.desc':    'IPv4 работает, IPv6 недоступен',
  'diag.R11.step.0':  'Узнай у провайдера поддержку IPv6',
  'diag.R11.step.1':  'Настрой IPv6 tunnel (Hurricane Electric)',
  'diag.R11.step.2':  'Или игнорируй — IPv4 достаточно',

  'diag.R12.title':   'Высокая задержка у провайдера',
  'diag.R12.desc':    'Шлюз близко, но первый хоп провайдера далеко',
  'diag.R12.step.0':  'Свяжись с провайдером',
  'diag.R12.step.1':  'Проверь качество линии',
  'diag.R12.step.2':  'Запроси диагностику у провайдера',
} as const;

export type TranslationKey = keyof typeof ru;
export default ru as Record<TranslationKey, string>;
