import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Optional language for fallback copy; defaults to English */
  language?: 'en' | 'si';
};

type State = {
  hasError: boolean;
  message?: string;
};

/**
 * Top-level safety net so a single uncaught render error does not white-screen
 * the entire app. Shows a simple recovery UI with reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message ? String(error.message).slice(0, 200) : undefined,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  private handleReset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const si = this.props.language === 'si';
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-white dark:bg-black text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center justify-center mb-4">
          <span className="text-2xl" aria-hidden="true">
            ⚠️
          </span>
        </div>
        <h1 className="text-lg font-bold text-[#062E22] dark:text-white mb-1">
          {si ? 'යමක් වැරදී ගියා' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mb-6">
          {si
            ? 'යෙදුමේ දෝෂයක් ඇති විය. නැවත පූරණය කර උත්සාහ කරන්න.'
            : 'An unexpected error occurred. Reload the page to continue.'}
        </p>
        {this.state.message ? (
          <p className="text-[11px] font-mono text-zinc-400 mb-4 max-w-md break-words">
            {this.state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-full bg-[#062E22] text-white text-sm font-bold hover:bg-emerald-900 transition-colors"
          >
            {si ? 'නැවත පූරණය' : 'Reload'}
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            {si ? 'නැවත උත්සාහ කරන්න' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }
}
