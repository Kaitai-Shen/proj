#!/usr/bin/env bash
# Hardened render invocation (matches backend docker renderer mode).
# Usage: ./policies/render-run.sh /abs/path/source_v1.py /abs/out_dir [ClassName]
set -euo pipefail

SRC_FILE="$(realpath "$1")"
SRC_DIR="$(dirname "$SRC_FILE")"
OUT_DIR="$(realpath "$2")"
CLASS="${3:-GeneratedScene}"

# Rootless, network-less, resource-limited per design doc §8.
# Source mounted read-only; only /task/out is writable by the container.
docker run --rm \
  --user 1000:1000 \
  --network none \
  --memory 2g --memory-swap 2g \
  --cpus 2 \
  --pids-limit 128 \
  --read-only \
  --tmpfs /tmp:size=256m \
  --tmpfs /work/media:size=1g \
  --tmpfs /home/renderer:size=128m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  -v "$SRC_DIR":/task/src:ro \
  -v "$OUT_DIR":/task/out \
  ai-tutor-video-renderer:latest \
  "/task/src/$(basename "$SRC_FILE")" "$CLASS"
