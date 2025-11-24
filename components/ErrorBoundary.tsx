import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary
 * 
 * A Class Component that catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 * 
 * Design Decision:
 * We use a "System Alert" aesthetic to match the app's theme, treating errors as 
 * "Module Failures" rather than generic web crashes.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production, this would send to Sentry/LogRocket
    console.error("Uncaught error in component:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="w-full p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 backdrop-blur-sm my-2 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-bold text-xs uppercase tracking-widest font-mono">System Module Failure</h3>
          </div>
          <p className="text-xs opacity-80 font-mono mb-3">
            {this.state.error?.message || "An unexpected error occurred in this visualization."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-[10px] bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded text-red-100 uppercase tracking-wider transition-colors border border-red-500/20"
          >
            Re-initialize Module
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}