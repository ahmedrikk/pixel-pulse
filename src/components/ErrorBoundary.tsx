import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-card border rounded-lg p-6 shadow-lg">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">
              The application encountered an error. Please try refreshing the page.
            </p>
            <details className="bg-secondary p-3 rounded-md text-sm overflow-auto max-h-64">
              <summary className="cursor-pointer font-medium mb-2">Error Details</summary>
              <pre className="whitespace-pre-wrap break-all">
                {this.state.error?.toString()}
                {"\n\n"}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
