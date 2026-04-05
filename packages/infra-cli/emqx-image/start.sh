#!/bin/sh
set -e
echo "[emqx-diag] ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[emqx-diag] hostname=$(hostname)"
echo "[emqx-diag] mem_total=$(awk '/MemTotal/{print $2}' /proc/meminfo)kB"
echo "[emqx-diag] nproc=$(nproc)"
echo "[emqx-diag] arch=$(uname -m)"
echo "[emqx-diag] kernel=$(uname -r)"
echo "[emqx-diag] dns=$(grep nameserver /etc/resolv.conf | head -2 | tr '\n' ' ')"
echo "[emqx-diag] emqx_version=$(cat /opt/emqx/releases/emqx_vars 2>/dev/null | head -1 || echo unknown)"
echo "[emqx-diag] starting emqx foreground"
exec /usr/bin/docker-entrypoint.sh emqx foreground
