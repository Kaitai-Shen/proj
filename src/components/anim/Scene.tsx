import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type SceneProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

const BG_BY_HUE: Record<string, string> = {
  dark: "#0b1020",
  blue: "#0a1228",
  green: "#0a1a16",
};

export const Scene: React.FC<SceneProps> = ({ title, subtitle, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 200 } });
  const underline = interpolate(frame, [8, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at 20% 10%, #16203a 0%, ${
          BG_BY_HUE.dark
        } 60%)`,
        padding: "70px 90px",
        fontFamily:
          "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
      }}
    >
      <div style={{ opacity: reveal }}>
        <h1 style={{ fontSize: 58, fontWeight: 700, color: "#eef2ff", margin: 0 }}>
          {title}
        </h1>
        {subtitle ? (
          <p style={{ fontSize: 26, color: "#93a4c8", marginTop: 10, margin: 0 }}>
            {subtitle}
          </p>
        ) : null}
        <div
          style={{
            height: 5,
            width: 150 * underline,
            background: "linear-gradient(90deg,#5b8cff,#8fb0ff)",
            borderRadius: 3,
            marginTop: 18,
          }}
        />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 20,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
