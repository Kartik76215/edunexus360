import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error-shell">
          <section className="app-error-card">
            <h1>Dashboard could not load</h1>
            <p>{this.state.error?.message || "Unexpected frontend error."}</p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("user");
                window.location.reload();
              }}
            >
              Clear Login and Reload
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
