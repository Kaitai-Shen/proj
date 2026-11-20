/**
 * 首屏插图：暖纸卡片上的坐标轴与波形（致敬 19 世纪科学图版）。
 * 纯装饰，加载时以描边动画“画出”曲线；尊重 prefers-reduced-motion。
 */
export default function HeroFigure() {
  return (
    <svg
      viewBox="0 0 520 400"
      role="img"
      aria-label="坐标轴上的一条正弦波形，象征教学动画"
      className="h-auto w-full"
    >
      <rect
        x="1"
        y="1"
        width="518"
        height="398"
        rx="24"
        fill="var(--site-surface-high)"
        stroke="var(--site-border)"
      />

      {/* 网格 */}
      <g stroke="var(--site-border)" strokeWidth="1" opacity="0.55">
        {[90, 150, 210, 270, 330].map((y) => (
          <line key={y} x1="56" y1={y} x2="464" y2={y} />
        ))}
        {[120, 200, 280, 360].map((x) => (
          <line key={x} x1={x} y1="58" x2={x} y2="330" />
        ))}
      </g>

      {/* 坐标轴 */}
      <g stroke="var(--site-ink-soft)" strokeWidth="1.6" strokeLinecap="round">
        <line x1="56" y1="330" x2="468" y2="330" />
        <line x1="56" y1="330" x2="56" y2="56" />
        <path d="m468 330-8-4.4v8.8Z" fill="var(--site-ink-soft)" stroke="none" />
        <path d="M56 56l-4.4 8h8.8Z" fill="var(--site-ink-soft)" stroke="none" />
      </g>

      {/* 参考余弦 */}
      <path
        d="M56 210c34-46 68-46 102 0s68 46 102 0 68-46 102 0 68 46 102 0"
        fill="none"
        stroke="var(--site-muted)"
        strokeWidth="1.6"
        strokeDasharray="5 6"
        opacity="0.7"
      />

      {/* 主波形 */}
      <path
        d="M56 210c34-92 68-92 102 0s68 92 102 0 68-92 102 0 68 92 102 0"
        fill="none"
        stroke="var(--site-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        pathLength={1}
        className="animate-draw"
      />

      {/* 采样点与标注 */}
      <line
        x1="260"
        y1="210"
        x2="260"
        y2="118"
        stroke="var(--site-ink-soft)"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity="0.8"
      />
      <circle cx="260" cy="118" r="5" fill="var(--site-accent)" />
      <circle cx="260" cy="118" r="9" fill="none" stroke="var(--site-accent)" opacity="0.35" />
      <circle cx="158" cy="210" r="2.6" fill="var(--site-ink-soft)" />
      <circle cx="362" cy="210" r="2.6" fill="var(--site-ink-soft)" />

      <text
        x="270"
        y="106"
        fill="var(--site-ink-soft)"
        fontSize="14"
        fontStyle="italic"
        style={{ fontFamily: "var(--site-font-display)" }}
      >
        A · sin(ωt)
      </text>
      <text
        x="452"
        y="352"
        fill="var(--site-muted)"
        fontSize="12"
        style={{ fontFamily: "var(--site-font-display)" }}
      >
        t
      </text>
      <text
        x="38"
        y="70"
        fill="var(--site-muted)"
        fontSize="12"
        style={{ fontFamily: "var(--site-font-display)" }}
      >
        y
      </text>

      {/* 画中画的“视频”暗示 */}
      <g transform="translate(372 62)">
        <rect
          width="92"
          height="58"
          rx="12"
          fill="var(--site-surface)"
          stroke="var(--site-border)"
        />
        <circle cx="46" cy="29" r="15" fill="var(--site-accent)" />
        <path d="M42 22.5v13l10-6.5Z" fill="var(--site-on-accent)" />
      </g>

      <text
        x="56"
        y="372"
        fill="var(--site-muted)"
        fontSize="11"
        letterSpacing="2"
      >
        图 1 · 把知识画成一条会动的曲线
      </text>
    </svg>
  );
}
