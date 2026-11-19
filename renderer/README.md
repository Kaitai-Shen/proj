# AI Tutor Video 渲染器容器

固定版本隔离渲染环境：Manim Community 0.19 + LaTeX（texlive）+ FFmpeg + 中文字体（Noto CJK）。

## 调用协议（backend 的 docker 渲染模式按此拼接）

```
docker run --rm \
  --user 1000:1000 --network none \
  --memory 2g --memory-swap 2g --cpus 2 --pids-limit 128 \
  --read-only --tmpfs /tmp:size=256m --tmpfs /work/media:size=1g \
  --security-opt no-new-privileges --cap-drop ALL \
  -v <abs_source_dir>:/task/src:ro \
  -v <abs_out_dir>:/task/out \
  ai-tutor-video-renderer:latest \
  /task/src/<source_vN.py> [ClassName]
```

- stdout 最后一行：`{"ok": true, "video": "/task/out/<source_vN>.mp4", "seconds": ..., "duration": ...}` 或 `{"ok": false, "error": "..."}`。
- 退出码 0 仅在 ok=true 且 ffprobe 校验通过（视频流存在、时长>0、1920x1080@30fps）时返回。
- 渲染超时默认 300s（容器内 env `RENDER_TIMEOUT_SECONDS` 可调）。
- 静态预检在 entrypoint 内做第一道过滤（危险 import 拒绝），但**真正的隔离靠容器策略**。

## 本机构建与验证（WSL2 内）

```bash
docker build -t ai-tutor-video-renderer:latest renderer/
mkdir -p /tmp/src /tmp/out && cp renderer/tests/example_scene.py /tmp/src/source_v1.py
renderer/policies/render-run.sh /tmp/src /tmp/out GeneratedScene
```

成功后 `/tmp/out/source_v1.mp4` + `source_v1.log` 存在。

## 注意

- 本机（Windows）暂无 Docker，开发期后端用 `RENDERER_MODE=stub`（ffmpeg testsrc）或 `local`（宿主 python -m manim）联调；docker 模式在 WSL2/云服务器启用。
- 镜像内 LaTeX 为 texlive 基础集 + latex-extra，覆盖 MathTex 常用宏包；若生成代码用到冷门宏包导致渲染失败，属预期失败路径（走 fixer 修复循环）。
