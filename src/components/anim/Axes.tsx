import React, { createContext, useContext } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type AxesCtx = {
  toX: (x: number) => number;
  toY: (y: number) => number;
  width: number;
  height: number;
  xRange: [number, number];
  yRange: [number, number];
};

const Ctx = createContext<AxesCtx | null>(null);

export const useAxes = (): AxesCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAxes 必须在 <AnimatedAxes> 内使用");
  return v;
};

export type AnimatedAxesProps = {
  xRange: [number, number];
  yRange: [number, number];
  width: number;
  height: number;
  xLabel?: string;
  yLabel?: string;
  gridStep?: number;
  children?: React.ReactNode;
};

const niceTicks = (min: number, max: number, step: number): number[] => {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
};

export const AnimatedAxes: React.FC<AnimatedAxesProps> = ({
  xRange,
  yRange,
  width,
  height,
  xLabel,
  yLabel,
  gridStep,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 200 } });

  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const toX = (x: number) => ((x - x0) / (x1 - x0)) * width;
  const toY = (y: number) => height - ((y - y0) / (y1 - y0)) * height;

  const step = gridStep ?? Math.max(1, Math.round((x1 - x0) / 8));
  const yStep = gridStep ?? Math.max(1, Math.round((y1 - y0) / 6));
  const xTicks = niceTicks(x0, x1, step);
  const yTicks = niceTicks(y0, y1, yStep);

  const originX = toX(Math.max(x0, Math.min(0, x1)));
  const originY = toY(Math.max(y0, Math.min(0, y1)));

  return (
    <Ctx.Provider value={{ toX, toY, width, height, xRange, yRange }}>
      <svg width={width} height={height} style={{ overflow: "visible", opacity: reveal }}>
        {/* grid */}
        {xTicks.map((t) => (
          <line
            key={`gx${t}`}
            x1={toX(t)} y1={0} x2={toX(t)} y2={height}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1}
          />
        ))}
        {yTicks.map((t) => (
          <line
            key={`gy${t}`}
            x1={0} y1={toY(t)} x2={width} y2={toY(t)}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1}
          />
        ))}
        {/* axes */}
        <line x1={0} y1={originY} x2={width + 14} y2={originY} stroke="#8fa3cc" strokeWidth={2} />
        <line x1={originX} y1={height} x2={originX} y2={-14} stroke="#8fa3cc" strokeWidth={2} />
        <polygon
          points={`${width + 16},${originY} ${width + 4},${originY - 5} ${width + 4},${originY + 5}`}
          fill="#8fa3cc"
        />
        <polygon points={`${originX},-16 ${originX - 5},-4 ${originX + 5},-4`} fill="#8fa3cc" />
        {/* ticks */}
        {xTicks.map((t) =>
          t === 0 ? null : (
            <g key={`tx${t}`}>
              <line x1={toX(t)} y1={originY - 5} x2={toX(t)} y2={originY + 5} stroke="#8fa3cc" strokeWidth={1.5} />
              <text x={toX(t)} y={originY + 24} fill="#7d8db3" fontSize={15} textAnchor="middle">{t}</text>
            </g>
          ),
        )}
        {yTicks.map((t) =>
          t === 0 ? null : (
            <g key={`ty${t}`}>
              <line x1={originX - 5} y1={toY(t)} x2={originX + 5} y2={toY(t)} stroke="#8fa3cc" strokeWidth={1.5} />
              <text x={originX - 12} y={toY(t) + 5} fill="#7d8db3" fontSize={15} textAnchor="end">{t}</text>
            </g>
          ),
        )}
        {xLabel ? (
          <text x={width + 10} y={originY + 44} fill="#aebadb" fontSize={18} textAnchor="end">{xLabel}</text>
        ) : null}
        {yLabel ? (
          <text x={originX - 14} y={-20} fill="#aebadb" fontSize={18} textAnchor="start">{yLabel}</text>
        ) : null}
        {children}
      </svg>
    </Ctx.Provider>
  );
};

export type PlotCurveProps = {
  fn: (x: number) => number;
  range?: [number, number];
  color?: string;
  strokeWidth?: number;
  drawDuration?: number;
  delay?: number;
  dashed?: boolean;
};

export const PlotCurve: React.FC<PlotCurveProps> = ({
  fn,
  range,
  color = "#5b8cff",
  strokeWidth = 4,
  drawDuration = 60,
  delay = 0,
  dashed = false,
}) => {
  const { toX, toY, xRange } = useAxes();
  const frame = useCurrentFrame();
  const [a, b] = range ?? xRange;
  const N = 240;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const x = a + ((b - a) * i) / N;
    const y = fn(x);
    if (Number.isFinite(y)) pts.push([toX(x), toY(y)]);
  }
  const d = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ");

  const segLen = pts.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const [px, py] = pts[i - 1];
    return acc + Math.hypot(p[0] - px, p[1] - py);
  }, 0);

  const progress = interpolate(frame - delay, [0, drawDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={dashed ? `${strokeWidth * 2} ${strokeWidth * 2}` : segLen}
      strokeDashoffset={dashed ? 0 : segLen * (1 - progress)}
    />
  );
};

export type PlotPointProps = {
  x: number;
  y: number;
  color?: string;
  r?: number;
  label?: string;
  labelSide?: "left" | "right" | "top" | "bottom";
  delay?: number;
};

export const PlotPoint: React.FC<PlotPointProps> = ({
  x,
  y,
  color = "#ffb454",
  r = 8,
  label,
  labelSide = "right",
  delay = 0,
}) => {
  const { toX, toY } = useAxes();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12 } });

  const px = toX(x);
  const py = toY(y);
  const off = 16;
  const labelPos: React.CSSProperties =
    labelSide === "right"
      ? { x: px + off, y: py + 6 }
      : labelSide === "left"
        ? { x: px - off, y: py + 6 }
        : labelSide === "top"
          ? { x: px, y: py - off }
          : { x: px, y: py + off + 8 };
  const anchor = labelSide === "left" ? "end" : labelSide === "right" ? "start" : "middle";

  return (
    <g opacity={pop}>
      <circle cx={px} cy={py} r={r * pop} fill={color} stroke="#0b1020" strokeWidth={2} />
      {label ? (
        <text x={labelPos.x} y={labelPos.y} fill="#eef2ff" fontSize={19} textAnchor={anchor}>
          {label}
        </text>
      ) : null}
    </g>
  );
};

export type LabeledArrowProps = {
  from: [number, number];
  to: [number, number];
  color?: string;
  label?: string;
  delay?: number;
};

export const LabeledArrow: React.FC<LabeledArrowProps> = ({
  from,
  to,
  color = "#63e6be",
  label,
  delay = 0,
}) => {
  const { toX, toY } = useAxes();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });

  const x1 = toX(from[0]);
  const y1 = toY(from[1]);
  const x2 = toX(to[0]);
  const y2 = toY(to[1]);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tipX = x1 + dx * pop;
  const tipY = y1 + dy * pop;
  const angle = Math.atan2(dy, dx);

  return (
    <g opacity={Math.min(1, pop * 2)}>
      <line x1={x1} y1={y1} x2={tipX} y2={tipY} stroke={color} strokeWidth={3.5} />
      <g transform={`translate(${tipX},${tipY}) rotate(${(angle * 180) / Math.PI})`}>
        <polygon points="0,0 -14,-6 -14,6" fill={color} />
      </g>
      {label ? (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 12}
          fill={color}
          fontSize={19}
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};
