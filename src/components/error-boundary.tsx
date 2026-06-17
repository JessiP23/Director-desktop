import * as React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render errors so one broken component shows a recoverable fallback
 * instead of white-screening the whole window (which is what happened when the
 * brief shape mismatch threw in the Timeline panel).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ui] render error", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-fg">Something went wrong rendering this view.</p>
          <p className="max-w-md font-mono text-xs text-fg-subtle">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="rounded-lg bg-ink-700 px-3 py-1.5 text-sm text-fg hover:bg-ink-600"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
