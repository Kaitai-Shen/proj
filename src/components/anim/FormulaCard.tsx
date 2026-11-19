import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import katex from "katex";

export type FormulaCardProps = {
  tex: string;
  caption?: string;
  delay?: number;
  scale?: number;
};

export const FormulaCard: React.FC<FormulaCardProps> = ({
  tex,
  caption,
  delay = 0,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const pop = spring({
    frame: local,
    fps,
    config: { damping: 14, stiffness: 130 },
  });
  const opacity = interpolate(local, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const html = katex.renderToString(tex, {
    throwOnError: false,
    displayMode: true,
  });

  return (
    <div
      style={{
        transform: `scale(${scale * (0.86 + 0.14 * pop)})`,
        opacity,
        background: "rgba(91,140,255,0.08)",
        border: "1.5px solid rgba(91,140,255,0.45)",
        borderRadius: 20,
        padding: "36px 56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{ color: "#eef2ff", fontSize: 40 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {caption ? (
        <div style={{ color: "#93a4c8", fontSize: 22 }}>{caption}</div>
      ) : null}
    </div>
  );
};
