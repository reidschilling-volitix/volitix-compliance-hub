import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (this.props.onError) this.props.onError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#f87171', background: '#1e293b', borderRadius: 16, fontFamily: 'monospace' }}>
          <h2>Something went wrong.</h2>
          <pre>{String(this.state.error)}</pre>
          {this.state.errorInfo && <details style={{ whiteSpace: 'pre-wrap' }}>{this.state.errorInfo.componentStack}</details>}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
