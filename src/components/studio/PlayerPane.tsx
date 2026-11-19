import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import html2canvas from "html2canvas";
import { useStudio } from "../../store/studio";
import { totalFrames, type PlayerBridge } from "../../agents/pipeline";
import { useCompiledLecture } from "../../sandbox";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Props = {
  bridgeRef: React.MutableRefObject<PlayerBridge | null>;
};

export default function PlayerPane({ bridgeRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const storyboard = useStudio((s) => s.storyboard);
  const generatedCode = useStudio((s) => s.generatedCode);
  const codeVersion = useStudio((s) => s.codeVersion);
  const phase = useStudio((s) => s.phase);
  const setShowQuiz = useStudio((s) => s.setShowQuiz);
  const compiled = useCompiledLecture(generatedCode);
  const total = storyboard ? totalFrames(storyboard) : 0;

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__playerRef = playerRef;
  }

  useEffect(() => {
    bridgeRef.current = {
      seekTo: async (frame: number) => {
        playerRef.current?.seekTo(frame);
        await sleep(200);
      },
      captureFrame: async () => {
        const el = containerRef.current;
        if (!el) throw new Error("播放器未就绪");
        const canvas = await html2canvas(el, {
          scale: 0.5,
          logging: false,
          backgroundColor: "#0b1020",
        });
        return canvas.toDataURL("image/jpeg", 0.75);
      },
      totalFrames: () => total,
    };
  });

  const quizShownRef = useRef(false);

  useEffect(() => {
    quizShownRef.current = false;
  }, [codeVersion]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      if (
        total > 0 &&
        e.detail.frame >= total - 1 &&
        !quizShownRef.current &&
        useStudio.getState().quiz.length > 0
      ) {
        quizShownRef.current = true;
        setShowQuiz(true);
      }
    };
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [codeVersion, total, setShowQuiz]);

  if (!compiled.ok) {
    if (!generatedCode.trim()) {
      return (
        <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-ink-900/60">
          <div className="text-center text-slate-500">
            <div className="mb-2 text-4xl">🎬</div>
            <p className="text-sm">等待生成…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-rose-500/30 bg-ink-900/60 p-6">
        <div className="max-w-md text-sm text-rose-300">
          <p className="mb-1 font-semibold">生成代码存在错误</p>
          <p className="whitespace-pre-wrap font-mono text-xs opacity-80">
            {compiled.error}
          </p>
        </div>
      </div>
    );
  }

  if (!storyboard || phase === "idle") {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-ink-900/60">
        <div className="text-center text-slate-500">
          <div className="mb-2 text-4xl">🎬</div>
          <p className="text-sm">输入知识点开始生成，视频将在这里实时播放</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-900/60"
    >
      <div className="flex-1 overflow-hidden bg-black/40">
        <Player
          key={codeVersion}
          ref={playerRef}
          component={compiled.Component}
          durationInFrames={Math.max(total, 1)}
          fps={30}
          compositionWidth={1920}
          compositionHeight={1080}
          style={{ width: "100%", height: "100%" }}
          controls
          autoPlay
          loop
          acknowledgeRemotionLicense
        />
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-slate-400">
        <span>
          共 {storyboard.sections.length} 节 · {total} 帧 ·{" "}
          {(total / 30).toFixed(0)} 秒 · 修订 v{codeVersion}
        </span>
        <span className="text-slate-500">1920×1080 · 30fps</span>
      </div>
    </div>
  );
}
