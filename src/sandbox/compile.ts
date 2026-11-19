import React, { type ComponentType } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { transform } from "sucrase";
import * as animLib from "../components/anim";

export type CompiledLecture =
  | { ok: true; Component: ComponentType }
  | { ok: false; error: string; phase: "transform" | "eval" | "contract" };

const REQUIRE_BLOCKED =
  "生成代码不应使用 import/require：React、Remotion 原语与动画组件已注入运行作用域，直接使用即可。";
const NETWORK_BLOCKED =
  "生成代码禁止发起网络请求：教学动画必须是确定性的纯渲染代码。";

type ScopeEntry = [name: string, value: unknown];

function buildScope(): ScopeEntry[] {
  const blocked = (message: string) => () => {
    throw new Error(message);
  };
  const entries: ScopeEntry[] = [
    ["React", React],
    ["useCurrentFrame", useCurrentFrame],
    ["useVideoConfig", useVideoConfig],
    ["interpolate", interpolate],
    ["spring", spring],
    ["Sequence", Sequence],
    ["AbsoluteFill", AbsoluteFill],
    ["Easing", Easing],
    ["require", blocked(REQUIRE_BLOCKED)],
    ["fetch", blocked(NETWORK_BLOCKED)],
    ["XMLHttpRequest", blocked(NETWORK_BLOCKED)],
  ];
  for (const [name, value] of Object.entries(animLib)) {
    entries.push([name, value]);
  }
  return entries;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function compileLecture(code: string): CompiledLecture {
  let js: string;
  try {
    js = transform(code, {
      transforms: ["jsx", "typescript", "imports"],
      production: true,
      jsxRuntime: "classic",
    }).code;
  } catch (e) {
    return { ok: false, error: messageOf(e), phase: "transform" };
  }

  const scope = buildScope();
  const moduleShim = { exports: {} as Record<string, unknown> };
  const exportsShim = moduleShim.exports;
  const argNames = [...scope.map(([name]) => name), "exports", "module"];
  const argValues = [...scope.map(([, value]) => value), exportsShim, moduleShim];

  try {
    const evaluate = new Function(...argNames, js);
    evaluate(...argValues);
  } catch (e) {
    return { ok: false, error: messageOf(e), phase: "eval" };
  }

  const exported = exportsShim.default ?? moduleShim.exports.default;
  if (typeof exported !== "function") {
    return {
      ok: false,
      error:
        "代码必须默认导出一个根组件，例如 export default function Lecture() { ... }。",
      phase: "contract",
    };
  }
  return { ok: true, Component: exported as ComponentType };
}
