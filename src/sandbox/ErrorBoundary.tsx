import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from "react";

export type ErrorBoundaryProps = {
  children: ReactNode;
  onError: (err: Error) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

const wrapperStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
};

const cardStyle: CSSProperties = {
  background: "#1a2236",
  border: "1px solid rgba(255,125,146,0.5)",
  borderRadius: 12,
  color: "#ff7d92",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 14,
  lineHeight: 1.7,
  maxWidth: 760,
  padding: "20px 28px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

export function ErrorCard({ message }: { message: string }) {
  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>{message}</div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return <ErrorCard message={this.state.error.message} />;
    }
    return this.props.children;
  }
}
