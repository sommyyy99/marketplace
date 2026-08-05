import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen grid place-items-center bg-[#fdf8ec] px-4 py-10">
        <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
          <h1 className="text-xl font-black text-[#111827] mb-2">Something went wrong</h1>
          <p className="text-sm text-[#667085] mb-4">
            The page hit an unexpected error. The details below help pinpoint the cause.
          </p>
          <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-4 whitespace-pre-wrap break-words max-h-[240px] overflow-auto">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="w-full min-h-[46px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors"
          >
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
