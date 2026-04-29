import axios from "axios";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const resolveApiBaseUrl = () => {
  const envBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (envBase) return trimTrailingSlash(envBase);
  return "http://127.0.0.1:5000/api";
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 20000
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error?.response) {
      const apiBase = api.defaults.baseURL || "/api";
      const isTimeout = error?.code === "ECONNABORTED";
      error.message = isTimeout
        ? `Request timed out while connecting to ${apiBase}. Please check backend server.`
        : `Cannot reach backend server at ${apiBase}. Start backend and try again.`;
    }

    if (
      error?.response?.status === 401 &&
      String(error?.response?.data?.message || "").toLowerCase().includes("login")
    ) {
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);

export default api;
