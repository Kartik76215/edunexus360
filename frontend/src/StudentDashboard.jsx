import { useEffect, useMemo, useRef, useState } from "react";
import api from "./lib/api";
import "./Dashboard.css";
import { sortTimetableSlots } from "./lib/timetable";
import {
  captureFaceEmbeddingWithLiveness,
  startCamera,
  stopCamera
} from "./lib/faceApiClient";

function StudentDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [notices, setNotices] = useState([]);
  const [messages, setMessages] = useState([]);
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [timetableRows, setTimetableRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [faceClasses, setFaceClasses] = useState([]);
  const [selectedFaceClassId, setSelectedFaceClassId] = useState("");
  const [faceStatus, setFaceStatus] = useState(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [capturingFaceAttendance, setCapturingFaceAttendance] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const setError = (message) => setNotice({ type: "error", message });
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const extractError = (err, fallback) =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

  const getWithFallback = async (paths) => {
    let lastErr = null;
    for (const path of paths) {
      try {
        return await api.get(path);
      } catch (err) {
        lastErr = err;
        if (err?.response?.status !== 404) throw err;
      }
    }
    throw lastErr;
  };

  const postWithFallback = async (paths, payload) => {
    let lastErr = null;
    for (const path of paths) {
      try {
        return await api.post(path, payload);
      } catch (err) {
        lastErr = err;
        if (err?.response?.status !== 404) throw err;
      }
    }
    throw lastErr;
  };

  const summary = useMemo(() => {
    const present = attendance.filter((a) => a.status === "present").length;
    const attendancePct = attendance.length > 0 ? ((present / attendance.length) * 100).toFixed(1) : "0.0";
    const avgMarks = marks.length > 0
      ? (marks.reduce((s, m) => s + Number(m.marks || 0), 0) / marks.length).toFixed(1)
      : "0.0";
    const pendingAssignments = assignments.length - submissions.length;
    const pendingFees = invoices
      .filter((i) => i.status !== "paid")
      .reduce(
        (s, i) => s + Math.max(0, Number(i.balanceAmount ?? Number(i.amount || 0) - Number(i.paidAmount || 0))),
        0
      );

    return { attendancePct, avgMarks, pendingAssignments: pendingAssignments > 0 ? pendingAssignments : 0, pendingFees };
  }, [attendance, marks, assignments, submissions, invoices]);

  const loadData = async () => {
    if (!user?._id) return;
    setLoading(true);
    const errors = [];
    try {
      const [attendanceRes, marksRes, enrollRes, invoicesRes, paymentsRes, noticesRes, messagesRes] =
        await Promise.allSettled([
          getWithFallback([`/attendance/${user._id}`]),
          getWithFallback([`/marks/${user._id}`]),
          getWithFallback([`/enrollments?studentId=${user._id}`]),
          getWithFallback([`/fee-invoices?studentId=${user._id}`, `/feeInvoices?studentId=${user._id}`]),
          getWithFallback([`/payments?studentId=${user._id}`]),
          getWithFallback([`/notices`]),
          getWithFallback([`/messages?toUserId=${user._id}`])
        ]);

      if (attendanceRes.status === "fulfilled") setAttendance(asArray(attendanceRes.value.data));
      else {
        setAttendance([]);
        errors.push("attendance");
      }

      if (marksRes.status === "fulfilled") setMarks(asArray(marksRes.value.data));
      else {
        setMarks([]);
        errors.push("marks");
      }

      if (invoicesRes.status === "fulfilled") setInvoices(asArray(invoicesRes.value.data));
      else {
        setInvoices([]);
        errors.push("fees");
      }

      if (paymentsRes.status === "fulfilled") setPayments(asArray(paymentsRes.value.data));
      else {
        setPayments([]);
        errors.push("payments");
      }

      const allNotices = noticesRes.status === "fulfilled" ? asArray(noticesRes.value.data) : [];
      if (noticesRes.status !== "fulfilled") errors.push("notices");

      if (messagesRes.status === "fulfilled") setMessages(asArray(messagesRes.value.data));
      else {
        setMessages([]);
        errors.push("messages");
      }

      const enrollment = enrollRes.status === "fulfilled" ? asArray(enrollRes.value.data)[0] : null;
      const classSectionId = enrollment?.classSectionId?._id;
      setNotices(
        allNotices.filter((n) => {
          if (n.audience === "all" || n.audience === "students") return true;
          if (n.audience !== "class" || !classSectionId) return false;
          return String(n.classSectionId?._id || n.classSectionId || "") === String(classSectionId);
        })
      );
      const course = String(user.course || "").trim();
      const semester = Number(user.semester || 1);
      const loadStudentTimetable = async () => {
        if (classSectionId) {
          const classRowsRes = await getWithFallback([`/timetables?classSectionId=${classSectionId}`]);
          const classRows = asArray(classRowsRes?.data);
          if (classRows.length > 0) return { data: classRows };
        }
        const studentRowsRes = await getWithFallback([`/timetables?studentId=${user._id}`]);
        return { data: asArray(studentRowsRes?.data) };
      };

      const [assignRes, subRes, subjectRes, timetableRes] = await Promise.allSettled([
        classSectionId ? getWithFallback([`/assignments?classSectionId=${classSectionId}`]) : Promise.resolve({ data: [] }),
        getWithFallback([`/submissions?studentId=${user._id}`]),
        course ? getWithFallback([`/subjects?course=${encodeURIComponent(course)}&semester=${semester}`]) : Promise.resolve({ data: [] }),
        loadStudentTimetable()
      ]);

      if (assignRes.status === "fulfilled") setAssignments(asArray(assignRes.value.data));
      else {
        setAssignments([]);
        errors.push("assignments");
      }

      if (subRes.status === "fulfilled") setSubmissions(asArray(subRes.value.data));
      else {
        setSubmissions([]);
        errors.push("submissions");
      }

      const tRows = timetableRes.status === "fulfilled" ? asArray(timetableRes.value.data) : [];
      if (subjectRes.status === "rejected") errors.push("subjects");
      if (timetableRes.status === "rejected") errors.push("timetable");
      setTimetableRows(sortTimetableSlots(tRows));

      if (errors.length > 0) {
        setNotice({
          type: "error",
          message: `Some sections could not load: ${errors.join(", ")}. Others are still available.`
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFaceAttendanceData = async () => {
    if (!user?._id) return;
    try {
      const classesRes = await getWithFallback([
        `/timetable/current?role=student&userId=${user._id}&today=true&includeChallenge=true`
      ]);
      const list = asArray(classesRes?.data?.classes);
      setFaceClasses(list);

      const preferred =
        list.find(
          (slot) =>
            (slot.isWithinWindow || slot.canMarkBySession || slot?.session?.isActive) &&
            !slot?.attendanceStatus?.alreadyMarked
        ) ||
        list[0] ||
        null;
      const currentSelection =
        list.find((slot) => String(slot.id) === String(selectedFaceClassId)) || null;
      const target = currentSelection || preferred;
      const nextId = target?.id || "";
      setSelectedFaceClassId(nextId);

      if (nextId) {
        const statusRes = await getWithFallback([
          `/attendance/status?studentId=${user._id}&timetableId=${nextId}`
        ]);
        setFaceStatus(statusRes.data || null);
      } else {
        setFaceStatus(null);
      }
    } catch (err) {
      setError(extractError(err, "Failed to load face attendance status."));
    }
  };

  const refreshFaceStatus = async (timetableId) => {
    if (!user?._id || !timetableId) return;
    try {
      const statusRes = await getWithFallback([
        `/attendance/status?studentId=${user._id}&timetableId=${timetableId}`
      ]);
      setFaceStatus(statusRes.data || null);
    } catch (err) {
      setError(extractError(err, "Failed to refresh attendance eligibility."));
    }
  };

  const startFaceCamera = async () => {
    try {
      setCameraBusy(true);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera API not supported in this browser.");
        return;
      }
      stopCamera(cameraStreamRef.current);
      cameraStreamRef.current = await startCamera(videoRef.current);
      setCameraStarted(true);
      setNotice({
        type: "success",
        message: "Camera ready. Blink once and turn your head slightly while capturing."
      });
    } catch (err) {
      setError(extractError(err, "Unable to start camera."));
    } finally {
      setCameraBusy(false);
    }
  };

  const stopFaceCapture = () => {
    stopCamera(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStarted(false);
  };

  const markFaceAttendance = async () => {
    if (!user?._id) return;
    if (!selectedFaceClassId) {
      setError("Select a class to mark attendance.");
      return;
    }
    if (!cameraStarted || !cameraStreamRef.current) {
      setError("Start camera first.");
      return;
    }

    try {
      setCapturingFaceAttendance(true);
      const capture = await captureFaceEmbeddingWithLiveness(videoRef.current, {
        timeoutMs: 4500
      });
      if (!capture?.liveness?.passed) {
        setError("Face check needs a clearer live face. Blink once or turn your head slightly, then try again.");
        return;
      }

      const challengeToken =
        faceStatus?.challengeToken ||
        faceClasses.find((item) => item.id === selectedFaceClassId)?.challengeToken;
      if (!challengeToken) {
        setError("Attendance challenge expired. Refresh status and try again.");
        return;
      }

      await api.post("/mark-attendance", {
        studentId: user._id,
        timetableId: selectedFaceClassId,
        embedding: capture.embedding,
        liveness: capture.liveness,
        challengeToken
      });

      setNotice({ type: "success", message: "Face attendance marked successfully." });
      await Promise.all([loadData(), loadFaceAttendanceData()]);
    } catch (err) {
      setError(extractError(err, "Failed to mark face attendance."));
    } finally {
      setCapturingFaceAttendance(false);
    }
  };

  const submitAssignment = async (assignmentId) => {
    if (!user?._id) return;
    const content = String(submissionDrafts[assignmentId] || "").trim();
    if (!content) {
      setError("Please write submission content before submitting.");
      return;
    }

    try {
      await api.post(`/submissions`, {
        assignmentId,
        studentId: user._id,
        content
      });
      setSubmissionDrafts((prev) => ({ ...prev, [assignmentId]: "" }));
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.response?.data?.error || "Failed to submit assignment."
      );
    }
  };

  const submitFeePayment = async (invoice) => {
    if (!user?._id || !invoice?._id) return;
    const draft = paymentDrafts[invoice._id] || {};
    const amount = Number(draft.amount);
    const remaining = Math.max(
      0,
      Number(invoice.balanceAmount ?? Number(invoice.amount || 0) - Number(invoice.paidAmount || 0))
    );

    if (Number.isNaN(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    if (amount > remaining) {
      setError(`Amount cannot be greater than remaining balance (${remaining}).`);
      return;
    }

    try {
      await postWithFallback(["/payments/submit", "/payments"], {
        feeInvoiceId: invoice._id,
        studentId: user._id,
        amount,
        method: draft.method || "upi",
        transactionRef: (draft.transactionRef || "").trim()
      });
      setPaymentDrafts((prev) => ({
        ...prev,
        [invoice._id]: { amount: "", method: "upi", transactionRef: "" }
      }));
      await loadData();
      setNotice({ type: "success", message: "Fee payment submitted successfully." });
    } catch (err) {
      setError(extractError(err, "Failed to submit fee payment."));
    }
  };

  useEffect(() => {
    loadData();
    loadFaceAttendanceData();
  }, []);

  useEffect(() => () => {
    stopFaceCapture();
  }, []);

  useEffect(() => {
    setPaymentDrafts((prev) => {
      const next = {};
      for (const invoice of invoices) {
        const existing = prev[invoice._id];
        const remaining = Math.max(
          0,
          Number(invoice.balanceAmount ?? Number(invoice.amount || 0) - Number(invoice.paidAmount || 0))
        );
        next[invoice._id] = existing || {
          amount: remaining > 0 ? String(remaining) : "",
          method: "upi",
          transactionRef: ""
        };
      }
      return next;
    });
  }, [invoices]);

  useEffect(() => {
    if (selectedFaceClassId) {
      refreshFaceStatus(selectedFaceClassId);
    }
  }, [selectedFaceClassId]);

  const refreshAll = async () => {
    await Promise.all([loadData(), loadFaceAttendanceData()]);
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "academics", label: "Academics" },
    { key: "assignments", label: "Assignments" },
    { key: "faceAttendance", label: "Face Attendance" },
    { key: "financials", label: "Financials" },
    { key: "communication", label: "Communication" }
  ];

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <h2>Student Portal</h2>
        <nav className="tab-list">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-button ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="danger-btn"
          onClick={() => {
            localStorage.removeItem("user");
            window.location.reload();
          }}
        >
          Logout
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Student Dashboard</h1>
            <p>
              Welcome {user?.name || "Student"}
              {user?.rollNumber ? ` | Class Roll: ${user.rollNumber}` : ""}
              {user?.universityRollNumber ? ` | Univ Roll: ${user.universityRollNumber}` : ""}
            </p>
          </div>
          <button className="secondary-btn" type="button" onClick={refreshAll}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {notice.message ? (
          <div className={`notice ${notice.type}`} role="alert">
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice({ type: "", message: "" })}>Dismiss</button>
          </div>
        ) : null}

        {activeTab === "overview" && (
          <section className="panel-grid stats-grid">
            <article className="panel card-strong"><h3>Attendance %</h3><p>{summary.attendancePct}%</p></article>
            <article className="panel card-strong"><h3>Average Marks</h3><p>{summary.avgMarks}</p></article>
            <article className="panel card-strong"><h3>Pending Assignments</h3><p>{summary.pendingAssignments}</p></article>
            <article className="panel card-strong"><h3>Pending Fees</h3><p>{summary.pendingFees}</p></article>
          </section>
        )}

        {activeTab === "academics" && (
          <section className="panel-stack">
            <article className="panel">
              <h3>Current Timetable</h3>
              <div className="table-wrap">
                {timetableRows.length === 0 ? (
                  <p>No timetable data.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Faculty</th>
                        <th>Class</th>
                        <th>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timetableRows.map((slot) => (
                        <tr key={slot._id}>
                          <td>{slot.dayOfWeek}</td>
                          <td>{slot.startTime} - {slot.endTime}</td>
                          <td>{slot.subjectId?.name || "Subject"}</td>
                          <td>{slot.facultyId?.name || "Faculty"}</td>
                          <td>{slot.classSectionId?.name || "Class"}</td>
                          <td>{slot.room || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </article>
            <article className="panel">
              <h3>Exam / Marks Records</h3>
              <div className="list-wrap">
                {marks.length === 0 ? <p>No marks yet.</p> : marks.map((m) => (
                  <div className="list-item" key={m._id}>
                    <div><strong>{m.subject}</strong><p>Score: {m.marks}</p></div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <h3>Attendance Records</h3>
              <div className="list-wrap">
                {attendance.length === 0 ? <p>No attendance records.</p> : attendance.map((a) => (
                  <div className="list-item" key={a._id}>
                    <div><strong>{a.subject}</strong><p>{new Date(a.date).toLocaleDateString()} | {a.status}</p></div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeTab === "assignments" && (
          <section className="panel-stack">
            <article className="panel">
              <h3>Assignments</h3>
              <div className="list-wrap">
                {assignments.length === 0 ? <p>No assignments.</p> : assignments.map((a) => {
                  const submitted = submissions.some((s) => s.assignmentId?._id === a._id || s.assignmentId === a._id);
                  return (
                    <div className="list-item" key={a._id}>
                      <div>
                        <strong>{a.title}</strong>
                        <p>Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                        <p>{a.description}</p>
                        {!submitted ? (
                          <div className="inline-field">
                            <input
                              placeholder="Write submission note"
                              value={submissionDrafts[a._id] || ""}
                              onChange={(e) =>
                                setSubmissionDrafts((prev) => ({ ...prev, [a._id]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => submitAssignment(a._id)}
                            >
                              Submit
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <span>{submitted ? "Submitted" : "Pending"}</span>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        )}

        {activeTab === "faceAttendance" && (
          <section className="panel-stack">
            <article className="panel">
              <h3>Face Attendance</h3>
              <p className="helper-text">
                Attendance is allowed in the first 10 minutes of class or while faculty has an active session open.
              </p>
              <div className="form-grid">
                <select
                  value={selectedFaceClassId}
                  onChange={(e) => setSelectedFaceClassId(e.target.value)}
                >
                  <option value="">Select Class</option>
                  {faceClasses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.subject?.name || "Subject"} | {row.startTime}-{row.endTime} |{" "}
                      {row.classSection?.name || "Class"}
                    </option>
                  ))}
                </select>
                <button className="secondary-btn" type="button" onClick={loadFaceAttendanceData}>
                  Refresh Eligibility
                </button>
                <button className="secondary-btn" type="button" onClick={startFaceCamera} disabled={cameraBusy}>
                  {cameraBusy ? "Preparing..." : "Start Camera"}
                </button>
                <button className="danger-btn" type="button" onClick={stopFaceCapture}>
                  Stop Camera
                </button>
                <button
                  className="primary-btn"
                  type="button"
                  onClick={markFaceAttendance}
                  disabled={!faceStatus?.canMark || capturingFaceAttendance || !cameraStarted}
                >
                  {capturingFaceAttendance ? "Verifying..." : "Mark Attendance"}
                </button>
              </div>
            </article>

            <article className="panel">
              <h3>Live Verification</h3>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: "100%", maxWidth: 420, borderRadius: 12, background: "#111" }}
              />
              <div className="list-wrap" style={{ marginTop: 10 }}>
                <div className="list-item">
                  <strong>Can Mark</strong>
                  <span>{faceStatus?.canMark ? "Yes" : "No"}</span>
                </div>
                <div className="list-item">
                  <strong>Status</strong>
                  <span>{faceStatus?.reason || "Select class and refresh eligibility."}</span>
                </div>
                <div className="list-item">
                  <strong>Already Marked</strong>
                  <span>{faceStatus?.alreadyMarked ? "Yes" : "No"}</span>
                </div>
              </div>
            </article>
          </section>
        )}

        {activeTab === "financials" && (
          <section className="panel-stack">
            <article className="panel">
              <h3>Fee Invoices</h3>
              <div className="list-wrap">
                {invoices.length === 0 ? <p>No invoices.</p> : invoices.map((i) => {
                  const remaining = Math.max(
                    0,
                    Number(i.balanceAmount ?? Number(i.amount || 0) - Number(i.paidAmount || 0))
                  );
                  const draft = paymentDrafts[i._id] || {};
                  return (
                    <div className="list-item" key={i._id}>
                      <div>
                        <strong>{i.title}</strong>
                        <p>
                          Total: {Number(i.amount || 0).toFixed(2)} | Paid: {Number(i.paidAmount || 0).toFixed(2)} | Due:{" "}
                          {remaining.toFixed(2)}
                        </p>
                        <p>Due Date: {new Date(i.dueDate).toLocaleDateString()} | Status: {i.status}</p>
                        {remaining > 0 ? (
                          <div className="form-grid">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="Amount"
                              value={draft.amount ?? ""}
                              onChange={(e) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [i._id]: { ...prev[i._id], amount: e.target.value }
                                }))
                              }
                            />
                            <select
                              value={draft.method || "upi"}
                              onChange={(e) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [i._id]: { ...prev[i._id], method: e.target.value }
                                }))
                              }
                            >
                              <option value="upi">UPI</option>
                              <option value="card">Card</option>
                              <option value="bank">Bank Transfer</option>
                              <option value="cash">Cash</option>
                            </select>
                            <input
                              placeholder="Transaction Ref (optional)"
                              value={draft.transactionRef || ""}
                              onChange={(e) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [i._id]: { ...prev[i._id], transactionRef: e.target.value }
                                }))
                              }
                            />
                            <button className="primary-btn" type="button" onClick={() => submitFeePayment(i)}>
                              Submit Fee
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
            <article className="panel">
              <h3>Payment History</h3>
              <div className="list-wrap">
                {payments.length === 0 ? <p>No payments.</p> : payments.map((p) => (
                  <div className="list-item" key={p._id}>
                    <div><strong>{p.amount}</strong><p>{new Date(p.paymentDate).toLocaleDateString()} | {p.method}</p></div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeTab === "communication" && (
          <section className="panel-stack">
            <article className="panel">
              <h3>Notices</h3>
              <div className="list-wrap">
                {notices.length === 0 ? <p>No notices.</p> : notices.map((n) => (
                  <div className="list-item notice-card" key={n._id}>
                    {n.imageData ? <img src={n.imageData} alt={n.imageName || n.title} /> : null}
                    <div>
                      <strong>{n.title}</strong>
                      <p>
                        {(n.noticeType || "notice").toUpperCase()}
                        {n.eventDate ? ` | ${new Date(n.eventDate).toLocaleDateString()}` : ""}
                      </p>
                      <p>{n.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <h3>Messages</h3>
              <div className="list-wrap">
                {messages.length === 0 ? <p>No messages.</p> : messages.map((m) => (
                  <div className="list-item" key={m._id}><div><strong>From: {m.fromUserId?.name || "System"}</strong><p>{m.content}</p></div></div>
                ))}
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

export default StudentDashboard;
