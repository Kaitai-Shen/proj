"""Minimal smoke-test scene for renderer validation (no LaTeX dependency)."""

from manim import (
    Scene,
    Create,
    Square,
    Circle,
    FadeOut,
    Text,
    VGroup,
    UP,
)


class GeneratedScene(Scene):
    def construct(self):
        title = Text("渲染器自检", font_size=48)
        self.play(Create(title), run_time=1)

        shapes = VGroup(Square(), Circle()).arrange(buff=1.5).shift(UP * -1)
        self.play(Create(shapes), run_time=2)
        self.wait(1)
        self.play(FadeOut(title), FadeOut(shapes), run_time=1)
