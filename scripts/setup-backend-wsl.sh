#!/usr/bin/env bash
# 在 WSL2 Ubuntu 内准备后端运行环境（等价于未来云上 Linux 部署形态）。
# 用法（Windows 侧执行）: wsl -d Ubuntu -u root -e bash /mnt/d/lc/proj/scripts/setup-backend-wsl.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y --no-install-recommends python3-venv ffmpeg

cd /mnt/d/lc/proj/backend
if [ ! -x .venv-wsl/bin/python ]; then
  python3 -m venv .venv-wsl
fi
.venv-wsl/bin/pip install --quiet -r requirements.txt

.venv-wsl/bin/python -c "import fastapi, sqlalchemy, openai; print('BACKEND_WSL_READY')"
ffmpeg -version | head -1
