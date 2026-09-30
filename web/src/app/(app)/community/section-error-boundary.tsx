"use client";

import { Component, type ReactNode } from "react";

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches rendering errors in a community page section
 * and logs them instead of crashing the whole page.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.name}] render error:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-error bg-error-container/15 p-4">
          <p className="text-sm text-error">
            Failed to load {this.props.name}. Check the console for details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
