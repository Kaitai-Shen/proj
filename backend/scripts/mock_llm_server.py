"""Offline OpenAI-compatible chat server for local end-to-end runs.

Serves POST /chat/completions and returns a canned DeepSeek-style answer:
- Planner prompt  -> valid LessonPlan JSON (duration from the user prompt)
- Coder/Fixer     -> minimal valid Manim scene code

Start it, then point the gateway at it:

    python scripts/mock_llm_server.py --port 9999
    set LLM_BASE_URL=http://127.0.0.1:9999
    set LLM_API_KEY=offline-test-key
    uvicorn app.main:app

This exercises the REAL LLM client HTTP path without any network access or key.
"""
from __future__ import annotations

import argparse
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def build_plan(user_prompt: str) -> str:
    m = re.search(r"duration_seconds:\s*(\d+)", user_prompt)
    duration = int(m.group(1)) if m else 30
    n = 2 if duration <= 45 else 3
    per = round(duration / n, 1)
    scenes = [{
        "scene_id": f"scene_{i:03d}",
        "order": i,
        "concept": f"概念 {i}",
        "narration": f"第 {i} 个场景：我们用动画演示这个概念。",
        "visual_instructions": f"绘制标题文本与示意图 {i}，使用 Transform 高亮变化。",
        "estimated_seconds": per,
        "required_objects": ["title_text", f"diagram_{i}"],
    } for i in range(1, n + 1)]
    return json.dumps({
        "title": "离线 Mock 分镜",
        "language": "zh-CN",
        "target_seconds": duration,
        "audience": "beginner",
        "learning_objectives": ["理解示例概念"],
        "scenes": scenes,
    }, ensure_ascii=False)


MANIM_CODE = """from manim import *

class GeneratedScene(Scene):
    def construct(self):
        title = Text("AI Tutor Video", font_size=36)
        box = Rectangle(width=6, height=2, color=BLUE)
        self.play(Write(title), run_time=1)
        self.play(Create(box), run_time=1)
        self.wait(1)
"""


CONCEPT_NOTES = (
    "【一句话本质】用「边界上的累积等于内部微小贡献之和」来理解这个概念。"
    "【公式/定义逐项拆解】左端沿边界逐段累积贡献，右端对内部每一点的微小贡献求和，"
    "两端度量的是同一个总量，相等是因为内部相邻微元的贡献互相抵消。"
    "【为什么成立】先取一个具体例子直接按定义算一遍，再用公式算一遍，数值一致即验证。"
    "【贯穿示例】取单位圆：按定义直接计算得 2π，用公式计算同样得 2π。"
    "【易错点与适用条件】要求函数连续可微；积分方向不能弄反。"
)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def do_POST(self):
        if not self.path.endswith("/chat/completions"):
            self._json(404, {"error": {"message": f"unknown path {self.path}"}})
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        messages = body.get("messages") or []
        system = next((m["content"] for m in messages if m.get("role") == "system"), "")
        user = next((m["content"] for m in messages if m.get("role") == "user"), "")

        if "Planner agent" in system:
            content = build_plan(user)
        elif "Concept Explainer" in system:
            content = CONCEPT_NOTES
        elif "Coder agent" in system or "Fixer agent" in system:
            content = "```python\n" + MANIM_CODE + "```"
        else:
            content = "{}"
        self._json(200, {
            "id": "chatcmpl-offline-mock",
            "object": "chat.completion",
            "model": body.get("model") or "offline-mock",
            "choices": [{"index": 0, "finish_reason": "stop",
                         "message": {"role": "assistant", "content": content}}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 34, "total_tokens": 46},
        })

    def _json(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=9999)
    args = parser.parse_args()
    print(f"offline mock LLM listening on http://127.0.0.1:{args.port} "
          "(set LLM_BASE_URL accordingly)")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
