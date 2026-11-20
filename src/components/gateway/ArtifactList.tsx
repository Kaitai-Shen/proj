import type { ComponentType } from "react";
import { artifactUrl, type ArtifactKind, type JobDetail } from "../../api/gatewayClient";
import {
  ChevronDown,
  ChevronUp,
  Code,
  Download,
  FileText,
  Film,
  Folder,
  Layers,
  MessageSquare,
  Volume2,
  type IconProps,
} from "../ui/Icons";

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

const KIND_ICONS: Record<ArtifactKind, ComponentType<IconProps>> = {
  lesson_plan: Folder,
  scene_code: Code,
  scene_video: Layers,
  final_video: Film,
  render_log: FileText,
  subtitles_srt: MessageSquare,
  subtitles_vtt: MessageSquare,
  narration_audio: Volume2,
};

/**
 * 任务产物列表：
 * - final_video → 深色画框内的播放器 + 下载；
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
      <p className="text-xs leading-relaxed text-ink-muted">
        产物就绪后会出现在这里：分镜计划、场景视频、成片与渲染日志。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {finalVideo && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            <Film size={14} />
            成片
          </h3>
          <figure className="panel-dark overflow-hidden rounded-card-sm border border-line bg-canvas">
            <video
              controls
              preload="metadata"
              src={artifactUrl(job.job_id, finalVideo.artifact_id)}
              className="aspect-video w-full bg-black"
            />
            <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-ink-muted">
              <span>
                {job.topic} · {formatSize(finalVideo.size_bytes)} · MP4
              </span>
              <a
                href={artifactUrl(job.job_id, finalVideo.artifact_id)}
                download
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                <Download size={13} />
                下载成片
              </a>
            </figcaption>
          </figure>
        </section>
      )}

      {sceneVideos.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            <Layers size={14} />
            分场景预览 <span className="font-normal text-ink-faint">（静音）</span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {sceneVideos.map((a) => (
              <figure key={a.artifact_id} className="group">
                <div className="panel-dark overflow-hidden rounded-card-sm border border-line bg-canvas transition group-hover:-translate-y-0.5">
                  <video
                    muted
                    controls
                    preload="metadata"
                    src={artifactUrl(job.job_id, a.artifact_id)}
                    className="aspect-video w-full bg-black"
                  />
                </div>
                <figcaption className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-ink-muted">
                  <span>{a.scene_id ?? "scene"}</span>
                  <span>{formatSize(a.size_bytes)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-card-sm border border-line">
          {others.map((a) => {
            const Icon = KIND_ICONS[a.kind] ?? FileText;
            return (
              <li
                key={a.artifact_id}
                className="hover-wash flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-card px-3.5 py-2.5 text-xs transition"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-oat text-ink-soft">
                  <Icon size={13} />
                </span>
                <span className="font-medium text-ink">
                  {KIND_LABELS[a.kind] ?? a.kind}
                </span>
                {a.scene_id && (
                  <span className="font-mono text-[10px] text-ink-faint">
                    {a.scene_id}
                  </span>
                )}
                <span className="text-[10px] text-ink-faint">
                  {formatSize(a.size_bytes)}
                </span>
                {a.kind === "lesson_plan" && onToggleStoryboard && (
                  <button onClick={onToggleStoryboard} className="pill-clay ml-1 py-0.5">
                    {storyboardOpen ? (
                      <>
                        收起分镜 <ChevronUp size={12} />
                      </>
                    ) : (
                      <>
                        查看分镜 <ChevronDown size={12} />
                      </>
                    )}
                  </button>
                )}
                <a
                  href={artifactUrl(job.job_id, a.artifact_id)}
                  download
                  className="btn-secondary ml-auto px-2.5 py-1 text-[11px]"
                >
                  <Download size={12} />
                  下载
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
