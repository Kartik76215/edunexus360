import { useEffect, useMemo, useRef, useState } from "react";
import api from "./lib/api";
import {
  captureFaceEmbedding,
  detectFaceStatus,
  ensureFaceModels,
  startCamera,
  stopCamera
} from "./lib/faceApiClient";
import "./Dashboard.css";

function FaceEnrollmentPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [samples, setSamples] = useState([]);
  const [detection, setDetection] = useState({ detected: false });
  const [loading, setLoading] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [modelsReady, setModelsReady] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionTimerRef = useRef(null);

  const adminUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const enrollmentUsers = useMemo(
    () => users.filter((row) => row.role === "student" || row.role === "faculty"),
    [users]
  );

  const setError = (text) => setMessage({ type: "error", text });
  const setSuccess = (text) => setMessage({ type: "success", text });

  const loadUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Failed to load users.");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => () => {
    if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
    stopCamera(streamRef.current);
  }, []);

  const startDetectionMonitor = () => {
    if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
    detectionTimerRef.current = setInterval(async () => {
      if (!streamRef.current || !videoRef.current) return;
      try {
        const status = await detectFaceStatus(videoRef.current);
        setDetection(status);
      } catch {
        setDetection({ detected: false });
      }
    }, 900);
  };

  const onStartCamera = async () => {
    try {
      setLoading(true);
      stopCamera(streamRef.current);
      streamRef.current = await startCamera(videoRef.current);
      setCameraStarted(true);
      try {
        await ensureFaceModels();
        setModelsReady(true);
        setSuccess("Camera started. Keep your face centered in frame.");
      } catch (modelErr) {
        setModelsReady(false);
        setError(
          modelErr?.message ||
            "Camera started, but face models failed to load. Check /public/face-models files."
        );
      }
      startDetectionMonitor();
    } catch (err) {
      setError(err?.message || "Unable to start camera.");
    } finally {
      setLoading(false);
    }
  };

  const onStopCamera = () => {
    if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
    stopCamera(streamRef.current);
    streamRef.current = null;
    setCameraStarted(false);
    setDetection({ detected: false });
  };

  const onCaptureSample = async () => {
    if (!cameraStarted || !videoRef.current) {
      setError("Start camera first.");
      return;
    }
    if (samples.length >= 5) {
      setError("Maximum 5 samples allowed.");
      return;
    }

    try {
      setCaptureBusy(true);
      const result = await captureFaceEmbedding(videoRef.current, { returnMeta: true });
      if (!result?.embedding) {
        setError("Face not detected properly. Try again.");
        return;
      }
      if (result.score < 0.55) {
        setError("Detection confidence too low. Improve lighting and recapture.");
        return;
      }

      setSamples((prev) => [
        ...prev,
        {
          embedding: result.embedding,
          score: result.score,
          box: result.box,
          capturedAt: new Date().toLocaleTimeString()
        }
      ]);
      setSuccess(`Sample ${samples.length + 1} captured.`);
    } catch (err) {
      setError(err?.message || "Failed to capture sample.");
    } finally {
      setCaptureBusy(false);
    }
  };

  const onSubmitEnrollment = async () => {
    if (!selectedUserId) {
      setError("Select a user before submitting.");
      return;
    }
    if (samples.length < 3 || samples.length > 5) {
      setError("Capture 3 to 5 samples.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/face-enroll", {
        userId: selectedUserId,
        embeddings: samples.map((item) => item.embedding),
        updatedBy: adminUser?._id
      });
      setSuccess("Face enrollment saved successfully.");
      setSamples([]);
      onStopCamera();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Enrollment failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel-stack">
      {message.text ? (
        <div className={`notice ${message.type || "success"}`}>
          <span>{message.text}</span>
        </div>
      ) : null}

      <article className="panel">
        <h2>Face Enrollment</h2>
        <p className="helper-text">
          Dedicated enrollment page with live detection checks. No raw images are saved; only face embeddings.
        </p>
        <div className="form-grid">
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select Student/Faculty</option>
            {enrollmentUsers.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name} ({row.role})
              </option>
            ))}
          </select>
          <button className="secondary-btn" type="button" onClick={onStartCamera} disabled={loading}>
            {loading ? "Loading..." : "Start Camera"}
          </button>
          <button className="danger-btn" type="button" onClick={onStopCamera}>
            Stop Camera
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={onCaptureSample}
            disabled={!cameraStarted || captureBusy || samples.length >= 5}
          >
            {captureBusy ? "Capturing..." : "Capture Sample"}
          </button>
          <button className="secondary-btn" type="button" onClick={() => setSamples([])}>
            Clear Samples
          </button>
          <button className="primary-btn" type="button" onClick={onSubmitEnrollment} disabled={loading}>
            Save Enrollment
          </button>
        </div>
      </article>

      <article className="panel">
        <h3>Live Camera</h3>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", maxWidth: 420, borderRadius: 12, background: "#111" }}
        />
        <div className="list-wrap" style={{ marginTop: 12 }}>
          <div className="list-item">
            <strong>Models Loaded</strong>
            <span>{modelsReady ? "Yes" : "No"}</span>
          </div>
          <div className="list-item">
            <strong>Face Detected</strong>
            <span>{detection.detected ? "Yes" : "No"}</span>
          </div>
          <div className="list-item">
            <strong>Detection Score</strong>
            <span>{detection.score ?? "-"}</span>
          </div>
          <div className="list-item">
            <strong>Captured Samples</strong>
            <span>{samples.length}/5</span>
          </div>
        </div>
      </article>

      <article className="panel">
        <h3>Sample Quality</h3>
        <div className="list-wrap">
          {samples.length === 0 ? (
            <p>No samples yet.</p>
          ) : (
            samples.map((sample, idx) => (
              <div className="list-item" key={`${sample.capturedAt}-${idx}`}>
                <div>
                  <strong>Sample {idx + 1}</strong>
                  <p>
                    Score: {sample.score} | Box: {sample.box?.width || 0}x{sample.box?.height || 0}
                  </p>
                </div>
                <span>{sample.capturedAt}</span>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

export default FaceEnrollmentPage;
