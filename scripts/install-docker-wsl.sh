#!/usr/bin/env bash
# 在 WSL2 Ubuntu 内安装并启动 Docker Engine（国内镜像源友好）。
# 用法（Windows 侧执行）: wsl -d Ubuntu -u root -e bash /mnt/d/lc/proj/scripts/install-docker-wsl.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

MIRROR_APT="https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux"

if command -v docker >/dev/null 2>&1; then
  echo "DOCKER_ALREADY_INSTALLED: $(docker --version)"
else
  apt-get update -y
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "$MIRROR_APT/ubuntu/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] $MIRROR_APT/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  echo "DOCKER_INSTALLED: $(docker --version)"
fi

# WSL 内启用 systemd（重启 WSL 后生效；未生效时用 service 兜底）
if [ -f /etc/wsl.conf ] && grep -q "systemd=true" /etc/wsl.conf; then
  echo "SYSTEMD_CONF_OK"
else
  printf "\n[boot]\nsystemd=true\n" >> /etc/wsl.conf 2>/dev/null || true
  echo "WSL_CONF_UPDATED (需 wsl --shutdown 后生效)"
fi

# Docker Hub 拉取走国内镜像加速
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run",
    "https://dockerproxy.net"
  ],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m" }
}
EOF

if systemctl is-system-running >/dev/null 2>&1; then
  systemctl enable --now docker
  echo "DOCKER_VIA_SYSTEMD"
else
  service docker start || (nohup dockerd >/var/log/dockerd.log 2>&1 &)
  echo "DOCKER_VIA_SERVICE"
fi

sleep 3
docker version --format 'Server: {{.Server.Version}}' && echo "DOCKER_READY"
