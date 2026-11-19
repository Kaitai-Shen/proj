import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type CaptionBarProps = {
  text: string;
  delay?: number;
};

export const CaptionBar: React.FC<CaptionBarProps> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const reveal = spring({ frame: local, fps: 30, config: { damping: 200 } });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 46,
        left: 90,
        right: 90,
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 18}px)`,
        background: "rgba(10,14,26,0.72)",
        border: "1px solid rgba(143,176,255,0.25)",
        borderRadius: 14,
        padding: "16px 28px",
        fontSize: 24,
        color: "#dbe4ff",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
};

export type FigureCardProps = {
  icon?: string;
  title: string;
  lines?: string[];
  delay?: number;
  width?: number;
};

export const FigureCard: React.FC<FigureCardProps> = ({
  icon,
  title,
  lines,
  delay = 0,
  width = 340,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  return (
    <div
      style={{
        width,
        opacity: pop,
        transform: `scale(${0.9 + 0.1 * pop})`,
        background: "rgba(255,255,255,0.05)",
        border: "1.5px solid rgba(255,255,255,0.14)",
        borderRadius: 18,
        padding: "26px 30px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {icon ? <div style={{ fontSize: 46 }}>{icon}</div> : null}
      <div style={{ fontSize: 28, fontWeight: 700, color: "#eef2ff" }}>{title}</div>
      {lines?.map((l, i) => (
        <div key={i} style={{ fontSize: 21, color: "#b7c4e3", lineHeight: 1.5 }}>
          {l}
        </div>
      ))}
    </div>
  );
};

export type TableCompareProps = {
  headers: string[];
  rows: string[][];
  highlightColumn?: number;
  delay?: number;
};

export const TableCompare: React.FC<TableCompareProps> = ({
  headers,
  rows,
  highlightColumn = -1,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });

  const cell = (text: string, isHeader: boolean, col: number) => (
    <td
      key={col}
      style={{
        padding: "12px 26px",
        fontSize: 22,
        color: isHeader ? "#eef2ff" : col === highlightColumn ? "#ffffff" : "#b7c4e3",
        fontWeight: isHeader || col === highlightColumn ? 700 : 400,
        background:
          col === highlightColumn && !isHeader
            ? "rgba(91,140,255,0.14)"
            : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        textAlign: "left",
      }}
    >
      {text}
    </td>
  );

  return (
    <table
      style={{
        opacity: reveal,
        borderCollapse: "collapse",
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <thead>
        <tr>{headers.map((h, i) => cell(h, true, i))}</tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>{row.map((c, ci) => cell(c, false, ci))}</tr>
        ))}
      </tbody>
    </table>
  );
};
