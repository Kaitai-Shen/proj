import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type StepListProps = {
  steps: string[];
  activeIndex?: number;
  delay?: number;
};

export const StepList: React.FC<StepListProps> = ({
  steps,
  activeIndex = -1,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {steps.map((step, i) => {
        const local = Math.max(0, frame - delay - i * 8);
        const reveal = spring({
          frame: local,
          fps,
          config: { damping: 200 },
        });
        const isActive = i === activeIndex;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: reveal,
              transform: `translateX(${(1 - reveal) * 30}px)`,
              background: isActive
                ? "rgba(91,140,255,0.16)"
                : "rgba(255,255,255,0.04)",
              border: isActive
                ? "1.5px solid rgba(91,140,255,0.7)"
                : "1.5px solid transparent",
              borderRadius: 14,
              padding: "14px 22px",
              minWidth: 420,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                background: isActive ? "#5b8cff" : "rgba(255,255,255,0.12)",
                color: isActive ? "#0b1020" : "#aebadb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontSize: 26, color: isActive ? "#ffffff" : "#c9d4ee" }}>
              {step}
            </div>
          </div>
        );
      })}
    </div>
  );
};
