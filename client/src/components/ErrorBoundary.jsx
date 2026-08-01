import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Catches render/lifecycle errors anywhere below it in the tree and shows a
 * fallback instead of an unmounted blank page. This is deliberately generic
 * (no dependency on router/toast context) so it can wrap the whole app —
 * error boundaries can only be class components, since there's no hooks
 * equivalent of getDerivedStateFromError/componentDidCatch yet.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Course-project scope: log to the console rather than a real error
    // reporting service. Swap this for Sentry/etc. in production.
    console.error('Unhandled error in the app:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={40} strokeWidth={1.5} />
          <h2>Something went wrong</h2>
          <p className="muted-text">
            This page ran into an unexpected error. Try reloading — if it keeps happening, let our support
            team know.
          </p>
          <button type="button" className="btn-primary" onClick={this.handleReload}>
            Back to home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
