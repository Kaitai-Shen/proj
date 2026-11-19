import type { Storyboard } from "../types";
import fourierCode from "./fourier.code.txt?raw";

export type Example = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  storyboard: Storyboard;
  code: string;
};

const fourierStoryboard: Storyboard = {
  topic: "傅里叶级数",
  audience: "大学生",
  sections: [
    {
      id: "s1",
      title: "什么是傅里叶级数",
      subtitle: "用简单的波，叠加出复杂的周期函数",
      narration: "傅里叶级数告诉我们：再复杂的周期函数，也是简单正弦波的合唱。",
      visual: "两张 FigureCard 并排：核心想法 + 琴键音色例子",
      frames: 270,
    },
    {
      id: "s2",
      title: "级数的数学形式",
      narration: "系数 an 和 bn，就是函数在不同频率上的成分含量。",
      visual: "FormulaCard 展示傅里叶级数求和公式",
      frames: 330,
    },
    {
      id: "s3",
      title: "方波与谐波叠加",
      subtitle: "项数越多，逼近越好",
      narration: "黄线是方波，蓝线是它的一次谐波近似。",
      visual: "AnimatedAxes + PlotCurve 画方波与其一次谐波",
      frames: 360,
    },
    {
      id: "s4",
      title: "三句话记住傅里叶级数",
      narration: "从信号处理到图像压缩，傅里叶级数都是最基础的积木。",
      visual: "StepList 三条要点总结",
      frames: 270,
    },
  ],
  quiz: [
    {
      question: "傅里叶级数的核心思想是什么？",
      options: [
        "任意函数都能用一个多项式精确表示",
        "周期函数可分解为正弦/余弦波的叠加",
        "所有信号都是随机的",
        "函数必须连续才能分解",
      ],
      answerIndex: 1,
      explanation: "傅里叶级数把周期函数分解为不同频率正弦/余弦分量的加权和。",
    },
    {
      question: "系数 aₙ 和 bₙ 代表什么？",
      options: [
        "函数的采样点数值",
        "频率 n 对应的成分含量",
        "函数的定义域范围",
        "误差项",
      ],
      answerIndex: 1,
      explanation: "an/bn 是频率 n 分量的权重，衡量该频率在函数中的含量。",
    },
    {
      question: "叠加的谐波项数增多会发生什么？",
      options: [
        "误差越来越大",
        "曲线变平滑但远离原函数",
        "对原函数的逼近越来越好",
        "没有影响",
      ],
      answerIndex: 2,
      explanation: "更多项意味着更多频率分量参与合成，逼近精度随项数提升。",
    },
  ],
};

export const EXAMPLES: Example[] = [
  {
    id: "fourier",
    emoji: "🌊",
    title: "傅里叶级数",
    desc: "4 节 · 41 秒 · 公式 + 波形叠加演示",
    storyboard: fourierStoryboard,
    code: fourierCode,
  },
];
