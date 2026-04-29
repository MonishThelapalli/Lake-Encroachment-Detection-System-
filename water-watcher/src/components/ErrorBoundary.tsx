import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unexpected error",
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Global UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="max-w-md p-6 rounded-lg border bg-white shadow">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">
              The interface hit an unexpected error. Try refreshing the page or returning to the analysis screen.
            </p>
            {this.state.message && (
              <p className="text-xs text-gray-500 border-t pt-2 break-all">{this.state.message}</p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

