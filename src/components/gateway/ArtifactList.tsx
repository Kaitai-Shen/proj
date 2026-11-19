import { artifactUrl, type ArtifactKind, type JobDetail } from "../../api/gatewayClient";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

const KIND_LABELS: Record<ArtifactKind, string> = {
  lesson_plan: "分镜计划",
  scene_code: "场景代码",
  scene_video: "场景视频",
  final_video: "成片",
  render_log: "渲染日志",
  subtitles_srt: "字幕 SRT",
  subtitles_vtt: "字幕 VTT",
  narration_audio: "旁白音频",
};

const KIND_ICONS: Record<ArtifactKind, string> = {
  lesson_plan: "🗂️",
  scene_code: "🧩",
  scene_video: "🎞️",
  final_video: "🎬",
  render_log: "📄",
  subtitles_srt: "💬",
  subtitles_vtt: "💬",
  narration_audio: "🔊",
};

/**
 * 任务产物列表：
 * - final_video → 大播放器（<video controls>，直链播放）+ 下载；
 * - scene_video → 逐场景缩略列表（静音 <video>）；
 * - 其余（lesson_plan / scene_code / render_log / 字幕…）→ 下载行，lesson_plan 附「查看分镜」。
 */
export default function ArtifactList({
  job,
  storyboardOpen,
  onToggleStoryboard,
}: {
  job: JobDetail;
  storyboardOpen?: boolean;
  onToggleStoryboard?: () => void;
}) {
  const finalVideo = job.artifacts.find((a) => a.kind === "final_video");
  const sceneVideos = job.artifacts.filter((a) => a.kind === "scene_video");
  const others = job.artifacts.filter(
    (a) => a.kind !== "final_video" && a.kind !== "scene_video",
  );

  if (job.artifacts.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        产物就绪后会出现在这里（分镜计划 / 场景视频 / 成片 / 渲染日志）。
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {finalVideo && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
            🎬 成片 final_video
          </h3>
          <video
            controls
            preload="metadata"
            src={artifactUrl(job.job_id, finalVideo.artifact_id)}
            className="w-full rounded-xl border border-white/10 bg-black"
          />
          <a
            href={artifactUrl(job.job_id, finalVideo.artifact_id)}
            download
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-soft hover:bg-accent/20"
          >
            ⬇ 下载成片（{formatSize(finalVideo.size_bytes)}）
          </a>
        </section>
      )}

      {sceneVideos.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
            🎞️ 分场景预览（静音）
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {sceneVideos.map((a) => (
              <figure key={a.artifact_id}>
                <video
                  muted
                  controls
                  preload="metadata"
                  src={artifactUrl(job.job_id, a.artifact_id)}
                  className="aspect-video w-full rounded-lg border border-white/10 bg-black"
                />
                <figcaption className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
                  <span>{a.scene_id ?? "scene"}</span>
                  <span>{formatSize(a.size_bytes)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {others.map((a) => (
            <li
              key={a.artifact_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-ink-900/40 px-3 py-2.5 text-xs"
            >
              <span className="shrink-0">{KIND_ICONS[a.kind] ?? "📦"}</span>
              <span className="font-medium text-slate-300">
                {KIND_LABELS[a.kind] ?? a.kind}
              </span>
              {a.scene_id && (
                <span className="font-mono text-[10px] text-slate-600">
                  {a.scene_id}
                </span>
              )}
              <span className="text-[10px] text-slate-600">
                {formatSize(a.size_bytes)}
              </span>
              {a.kind === "lesson_plan" && onToggleStoryboard && (
                <button
                  onClick={onToggleStoryboard}
                  className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent-soft hover:bg-accent/20"
                >
                  {storyboardOpen ? "收起分镜 ▲" : "查看分镜 ▼"}
                </button>
              )}
              <a
                href={artifactUrl(job.job_id, a.artifact_id)}
                download
                className="ml-auto rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
              >
                下载
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
