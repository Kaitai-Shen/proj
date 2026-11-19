import { createElement, useCallback, useEffect, useMemo } from "react";
import { compileLecture, type CompiledLecture } from "./compile";
import { ErrorBoundary, ErrorCard } from "./ErrorBoundary";

export { compileLecture, ErrorBoundary };
export type { CompiledLecture };

export type RuntimeIssue = { message: string };

export function useCompiledLecture(code: string): CompiledLecture {
  return useMemo(() => compileLecture(code), [code]);
}

type LectureRunnerProps = {
  code: string;
  onError: (issue: RuntimeIssue) => void;
};

export function LectureRunner({ code, onError }: LectureRunnerProps) {
  const compiled = useCompiledLecture(code);
  const onRuntimeError = useCallback(
    (err: Error) => onError({ message: err.message }),
    [onError],
  );

  useEffect(() => {
    if (!compiled.ok) onError({ message: compiled.error });
  }, [compiled, onError]);

  if (!compiled.ok) {
    return createElement(ErrorCard, { message: compiled.error });
  }
  return createElement(ErrorBoundary, {
    key: code,
    onError: onRuntimeError,
    children: createElement(compiled.Component),
  });
}
