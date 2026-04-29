import { useState } from "react";
import api from "./lib/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      window.location.reload();
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.response?.data?.error || "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <h2>Login</h2>

        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <p className="login-error">{error}</p> : null}

        <button type="button" onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

export default Login;
