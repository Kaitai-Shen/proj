/** 深色“成品画框”，用于演示入口：纸面上的视频海报，暗示可播放样片。 */
export default function WavePoster({
  caption,
  className,
}: {
  caption?: string;
  className?: string;
}) {
  return (
    <div
      className={`panel-dark relative aspect-video w-full overflow-hidden rounded-card-sm border border-line bg-canvas ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="var(--site-border)" strokeWidth="0.8" opacity="0.5">
          {[36, 72, 108, 144].map((y) => (
            <line key={y} x1="0" y1={y} x2="320" y2={y} />
          ))}
          {[64, 128, 192, 256].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="180" />
          ))}
        </g>
        <path
          d="M0 96c26-56 52-56 78 0s52 56 78 0 52-56 78 0 52 56 86 0"
          fill="none"
          stroke="var(--site-accent)"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="160" cy="96" r="18" fill="var(--site-accent)" opacity="0.16" />
        <circle cx="160" cy="96" r="12" fill="var(--site-accent)" />
        <path d="M156.5 90.5v11l8.5-5.5Z" fill="var(--site-on-accent)" />
      </svg>
      {caption ? (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2 pt-6 text-[10px] tracking-wide text-white/80">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
