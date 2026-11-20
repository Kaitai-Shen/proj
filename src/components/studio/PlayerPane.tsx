import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import html2canvas from "html2canvas";
import { useStudio } from "../../store/studio";
import { totalFrames, type PlayerBridge } from "../../agents/pipeline";
import { useCompiledLecture } from "../../sandbox";
import { Film } from "../ui/Icons";

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
          backgroundColor: "#1b1a17",
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
        <div className="panel-dark flex h-full min-h-[240px] items-center justify-center rounded-card-sm border border-line bg-canvas">
          <div className="text-center text-ink-muted">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line">
              <Film size={22} />
            </span>
            <p className="text-sm">等待生成…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-card-sm border tone-danger p-6">
        <div className="max-w-md text-sm">
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
      <div className="panel-dark flex h-full min-h-[240px] items-center justify-center rounded-card-sm border border-line bg-canvas">
        <div className="max-w-xs text-center text-ink-muted">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line">
            <Film size={22} />
          </span>
          <p className="text-sm leading-relaxed">
            输入知识点开始生成，视频将在这里实时播放
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="panel-dark flex h-full flex-col overflow-hidden rounded-card-sm border border-line bg-canvas"
    >
      <div className="flex-1 overflow-hidden bg-black">
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
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-muted">
        <span>
          共 {storyboard.sections.length} 节 · {total} 帧 ·{" "}
          {(total / 30).toFixed(0)} 秒 · 修订 v{codeVersion}
        </span>
        <span className="text-ink-faint">1920×1080 · 30fps</span>
      </div>
    </div>
  );
}
