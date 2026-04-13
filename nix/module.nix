# Home Network Monitor — NixOS module
#
# Provides a hardened systemd service for the home-network-monitor package.
#
# Portability notes (read before adjusting serviceConfig):
#
#  1. MemoryDenyWriteExecute = false  ← MUST stay false.
#     Bun embeds JavaScriptCore whose JIT maps pages as W+X simultaneously.
#     Setting this to true crashes Bun immediately at startup.
#     There is no workaround short of disabling the JIT entirely.
#
#  2. AmbientCapabilities + DynamicUser
#     DynamicUser implies NoNewPrivileges=true (blocks setuid escalation).
#     AmbientCapabilities work independently of NoNewPrivileges: they are
#     placed in the ambient set *before* exec and are inherited by child
#     processes without any privilege escalation.  Requires systemd ≥ 249
#     (NixOS 22.05+).  On NixOS the ping/traceroute security wrappers at
#     /run/wrappers/bin/ are bypassed; CAP_NET_RAW is granted directly.
#
#  3. SystemCallFilter
#     io_uring_{setup,enter,register} were added to @system-service in
#     systemd 255 (NixOS 24.05).  They are listed explicitly here for
#     compatibility with NixOS 22.11–23.11 (systemd 251–254).
#     Bun uses io_uring on Linux kernels ≥ 5.1 for high-throughput I/O.
#
#  4. RestrictAddressFamilies = AF_NETLINK
#     The `ip route show default` subprocess uses netlink to query kernel
#     routing tables.  Without AF_NETLINK the gateway auto-detection fails
#     silently; the service continues running with GATEWAY_PLACEHOLDER.
#
#  5. /proc/net/dev access
#     DynamicUser implies ProtectSystem=strict (most of / is read-only) but
#     /proc/net/dev is NOT affected — it is a network-namespace file, not
#     a regular filesystem path.  No BindPaths or ProtectProc override needed.
#
#  6. /var/lib/dhcp/dhclient.leases
#     On NixOS DHCP is usually managed by systemd-networkd or dhcpcd, not
#     dhclient, so this file typically does not exist.  The DHCP checker
#     handles ENOENT gracefully and falls back to "ok" status.
#
#  7. traceroute UDP mode
#     traceroute(8) sends UDP probes and listens for ICMP TTL-exceeded
#     responses.  Only CAP_NET_RAW is required (not CAP_NET_ADMIN) for
#     the default UDP mode with the `-n` flag used by this service.

self: { config, lib, pkgs, ... }:

let
  cfg = config.services.home-network-monitor;
in
{
  # ── Options ──────────────────────────────────────────────────────────────────

  options.services.home-network-monitor = {

    enable = lib.mkEnableOption "Home Network Monitor network diagnostics service";

    package = lib.mkOption {
      type        = lib.types.package;
      default     = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression
        "home-network-monitor.packages.\${system}.default";
      description = "The home-network-monitor package to use.";
    };

    port = lib.mkOption {
      type        = lib.types.port;
      default     = 3201;
      description = "TCP port the web dashboard listens on.";
    };

    openFirewall = lib.mkOption {
      type        = lib.types.bool;
      default     = false;
      description = ''
        Open {option}`services.home-network-monitor.port` in the NixOS
        stateful firewall ({option}`networking.firewall`).
      '';
    };

    environmentFile = lib.mkOption {
      type        = lib.types.nullOr lib.types.path;
      default     = null;
      example     = "/run/secrets/home-network-monitor.env";
      description = ''
        Path to an environment file loaded by systemd
        (see {manpage}`systemd.exec(5)` EnvironmentFile=).

        Useful for configuring targets without touching the module:

        ```
        PING_TARGETS=192.168.1.1:Router,8.8.8.8:Google
        DNS_SERVERS=192.168.1.1:Router DNS,1.1.1.1:Cloudflare
        HTTP_TARGETS=https://example.com
        ```
      '';
    };

    settings = {

      sslHosts = lib.mkOption {
        type        = with lib.types; listOf str;
        default     = [ "google.com" "cloudflare.com" "github.com" ];
        example     = lib.literalExpression ''[ "example.com" "myapp.internal" ]'';
        description = "Hostnames whose TLS certificates are monitored for expiry.";
      };

      iperf3Server = lib.mkOption {
        type        = lib.types.nullOr lib.types.str;
        default     = null;
        example     = "192.168.1.100";
        description = ''
          Optional iperf3 server address for LAN bandwidth testing.
          When set, {package}`iperf3` is added to the service PATH automatically.
        '';
      };

    };
  };

  # ── Implementation ────────────────────────────────────────────────────────────

  config = lib.mkIf cfg.enable {

    systemd.services.home-network-monitor = {
      description   = "Home Network Monitor";
      documentation = [ "https://github.com/gpont/home-network-monitor" ];
      wantedBy      = [ "multi-user.target" ];
      after         = [ "network-online.target" ];
      wants         = [ "network-online.target" ];

      # Binaries spawned as subprocesses by the checkers:
      #   ip(8)         iproute2   gateway detection, DHCP interface check
      #   ping(8)       iputils    ICMP latency, IPv6 reachability, MTU probe
      #   traceroute(8) traceroute path tracing (needs CAP_NET_RAW)
      #   dig(8)        dnsutils   DNS latency, consistency, NXDOMAIN check
      #   openssl(1)    openssl    TLS cert expiry (fallback when Bun TLS API
      #                            does not expose validTo on the response)
      #   sh(1)         bash       shell pipeline in the openssl fallback
      path = with pkgs;
        [ iproute2 iputils traceroute dnsutils openssl bash ]
        ++ lib.optional (cfg.settings.iperf3Server != null) iperf3;

      environment = {
        PORT  = toString cfg.port;

        # Override the Docker-oriented default (/app/data/monitor.db).
        DB_PATH = "/var/lib/home-network-monitor/monitor.db";

        SSL_HOSTS = lib.concatStringsSep "," cfg.settings.sslHosts;

        # DynamicUser does not set $HOME; Bun may look for ~/.bun at runtime.
        # Point HOME to the persistent state directory so any runtime cache
        # lands in a writable location instead of failing with EROFS.
        HOME = "/var/lib/home-network-monitor";
      } // lib.optionalAttrs (cfg.settings.iperf3Server != null) {
        IPERF3_SERVER = cfg.settings.iperf3Server;
      };

      serviceConfig = {
        ExecStart  = "${cfg.package}/bin/home-network-monitor";
        Restart    = "on-failure";
        RestartSec = "5s";
        Type       = "simple";

        # ── Identity ────────────────────────────────────────────────────────────
        # DynamicUser allocates a transient UID/GID per activation and implies:
        #   PrivateTmp=yes, ProtectSystem=strict, ProtectHome=read-only,
        #   NoNewPrivileges=yes, RestrictSUIDSGID=yes, RemoveIPC=yes.
        DynamicUser        = true;

        # systemd creates /var/lib/home-network-monitor owned by the dynamic UID.
        StateDirectory     = "home-network-monitor";
        StateDirectoryMode = "0750";

        # ── Capabilities ────────────────────────────────────────────────────────
        # CAP_NET_RAW: required by ping(8) and traceroute(8) to open raw ICMP
        # sockets.  Granted via the ambient set so child processes inherit it
        # without needing setuid or file capabilities on the binaries.
        # See portability note #2 above.
        AmbientCapabilities   = [ "CAP_NET_RAW" ];
        CapabilityBoundingSet = [ "CAP_NET_RAW" ];

        # ── Filesystem hardening ────────────────────────────────────────────────
        # ProtectSystem=strict (from DynamicUser) makes most of / read-only.
        # These options add further kernel-level restrictions:
        PrivateDevices        = true;  # hide real /dev devices; keep pseudo-devs
        ProtectKernelTunables = true;  # /proc/sys and /sys become read-only
        ProtectKernelModules  = true;  # block module loading (init_module etc.)
        ProtectKernelLogs     = true;  # hide /proc/kmsg and /dev/kmsg
        ProtectControlGroups  = true;  # read-only cgroup hierarchy
        ProtectHostname       = true;  # block sethostname(2)
        ProtectClock          = true;  # block clock_settime(2) and adjtimex(2)

        # ── Network hardening ────────────────────────────────────────────────────
        # This service is a network monitor so it legitimately needs broad
        # network access.  Restrict to address families that are actually used:
        RestrictAddressFamilies = [
          "AF_INET"     # IPv4 TCP/UDP (ping targets, HTTP checks, speedtest)
          "AF_INET6"    # IPv6 TCP/UDP (ping6, DoH, IPv6 connectivity check)
          "AF_UNIX"     # UNIX sockets (Bun internals, SQLite advisory locking)
          "AF_NETLINK"  # netlink — `ip route` subprocess queries kernel routing
        ];

        # ── Process hardening ────────────────────────────────────────────────────
        LockPersonality         = true;  # block personality(2) domain changes
        RestrictRealtime        = true;  # block real-time scheduling syscalls
        RestrictNamespaces      = true;  # block namespace creation (unshare etc.)
        SystemCallArchitectures = "native";

        # ── CRITICAL: JIT compatibility ──────────────────────────────────────────
        # Bun embeds JavaScriptCore whose JIT compiler maps memory pages as
        # simultaneously writable AND executable (W+X).
        # MemoryDenyWriteExecute = true blocks mprotect(PROT_WRITE|PROT_EXEC)
        # and WILL crash Bun immediately at startup.
        # This cannot be mitigated without disabling the JIT.  See note #1 above.
        MemoryDenyWriteExecute = false;

        # ── Syscall allowlist ────────────────────────────────────────────────────
        # @system-service covers the standard server syscall set (sockets,
        # file I/O, signals, timers, process management, …).
        # io_uring_* syscalls are listed explicitly: they were added to
        # @system-service in systemd 255 but older NixOS releases need them
        # listed separately.  See portability note #3 above.
        SystemCallFilter = [
          "@system-service"
          "io_uring_setup"
          "io_uring_enter"
          "io_uring_register"
        ];
      } // lib.optionalAttrs (cfg.environmentFile != null) {
        EnvironmentFile = cfg.environmentFile;
      };
    };

    # Open the dashboard port in the NixOS stateful firewall.
    networking.firewall.allowedTCPPorts =
      lib.mkIf cfg.openFirewall [ cfg.port ];
  };
}
