import { Scene, type SceneProps } from "./Scene";
import { FormulaCard, type FormulaCardProps } from "./FormulaCard";
import { StepList, type StepListProps } from "./StepList";
import {
  AnimatedAxes,
  PlotCurve,
  PlotPoint,
  LabeledArrow,
  useAxes,
  type AnimatedAxesProps,
  type PlotCurveProps,
  type PlotPointProps,
  type LabeledArrowProps,
} from "./Axes";
import {
  CaptionBar,
  FigureCard,
  TableCompare,
  type CaptionBarProps,
  type FigureCardProps,
  type TableCompareProps,
} from "./Basics";

export const VIDEO_CONFIG = { width: 1920, height: 1080, fps: 30 } as const;

export const PALETTE = {
  accent: "#5b8cff",
  accentSoft: "#8fb0ff",
  amber: "#ffb454",
  mint: "#63e6be",
  rose: "#ff7d92",
  violet: "#b18cff",
  text: "#eef2ff",
  textDim: "#b7c4e3",
} as const;

export {
  Scene,
  FormulaCard,
  StepList,
  AnimatedAxes,
  PlotCurve,
  PlotPoint,
  LabeledArrow,
  CaptionBar,
  FigureCard,
  TableCompare,
  useAxes,
};
export type {
  SceneProps,
  FormulaCardProps,
  StepListProps,
  AnimatedAxesProps,
  PlotCurveProps,
  PlotPointProps,
  LabeledArrowProps,
  CaptionBarProps,
  FigureCardProps,
  TableCompareProps,
};
