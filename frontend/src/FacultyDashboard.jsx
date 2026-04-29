import { useEffect, useMemo, useState } from "react";
import api from "./lib/api";
import "./Dashboard.css";
import { sortTimetableSlots } from "./lib/timetable";
import { buildCourseOptions } from "./lib/courses";

const emptyAttendanceForm = {
  subjectId: "",
  status: "present",
  date: ""
};

const emptyMarksForm = {
  subjectId: "",
  score: ""
};

const emptyClassForm = {
  course: "",
  semester: 1,
  subjectId: "",
  date: ""
};

function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendanceForm);
  const [marksForm, setMarksForm] = useState(emptyMarksForm);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [bulkStatusMap, setBulkStatusMap] = useState({});
  const [bulkMarksMap, setBulkMarksMap] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [myMarks, setMyMarks] = useState([]);
  const [myTimetable, setMyTimetable] = useState([]);
  const [faceClasses, setFaceClasses] = useState([]);
  const [selectedFaceClassId, setSelectedFaceClassId] = useState("");
  const [liveFaceAttendance, setLiveFaceAttendance] = useState([]);
  const [liveFaceStats, setLiveFaceStats] = useState({ presentCount: 0, absentCount: 0 });
  const [myAssignments, setMyAssignments] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesterFees, setSemesterFees] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [notices, setNotices] = useState([]);
  const [search, setSearch] = useState("");
  const [attendanceRollQuery, setAttendanceRollQuery] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    subjectId: "",
    classSectionId: "",
    dueDate: ""
  });
  const [messageForm, setMessageForm] = useState({
    toUserId: "",
    classSectionId: "",
    content: "",
    isBroadcast: false
  });
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState({ users: false, subjects: false, action: false });
  const [supportsAggregateFetch, setSupportsAggregateFetch] = useState(true);

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);

  const courseOptions = useMemo(() => {
    return buildCourseOptions({
      departments,
      users,
      subjects,
      semesterFees,
      classSections,
      timetables: myTimetable
    });
  }, [departments, users, subjects, semesterFees, classSections, myTimetable]);

  const classStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          String(s.course || "").trim().toLowerCase() ===
            String(classForm.course || "").trim().toLowerCase() &&
          Number(s.semester) === Number(classForm.semester)
      ),
    [students, classForm.course, classForm.semester]
  );

  const filteredStudents = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase().trim())),
    [students, search]
  );

  const classCount = useMemo(() => {
    const keys = new Set(students.map((s) => `${s.course || "NA"}-${s.semester || "NA"}`));
    return keys.size;
  }, [students]);

  const avgPostedMarks = useMemo(() => {
    if (myMarks.length === 0) return "0.0";
    const total = myMarks.reduce((sum, m) => sum + Number(m.marks || 0), 0);
    return (total / myMarks.length).toFixed(1);
  }, [myMarks]);

  const selectedFaceClass = useMemo(
    () => faceClasses.find((slot) => String(slot.id) === String(selectedFaceClassId)) || null,
    [faceClasses, selectedFaceClassId]
  );

  const canFacultyMarkAttendance = Boolean(
    selectedStudent && attendanceForm.subjectId && attendanceForm.date
  );

  const setSuccess = (message) => setNotice({ type: "success", message });
  const setError = (message) => setNotice({ type: "error", message });
  const extractError = (err, fallback) =>
    err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

  const postAttendanceCompat = async (payload) => {
    try {
      return await api.post("/attendance", payload);
    } catch (err) {
      const status = err?.response?.status;
      if ((status === 400 || status === 404) && payload.subject) {
        return api.post("/attendance", {
          studentId: payload.studentId,
          subject: payload.subject,
          status: payload.status,
          date: payload.date,
          teacherId: payload.teacherId
        });
      }
      throw err;
    }
  };

  const postMarksCompat = async (payload) => {
    try {
      return await api.post("/marks", payload);
    } catch (err) {
      const status = err?.response?.status;
      if ((status === 400 || status === 404) && payload.subject) {
        return api.post("/marks", {
          studentId: payload.studentId,
          subject: payload.subject,
          marks: payload.marks,
          teacherId: payload.teacherId
        });
      }
      throw err;
    }
  };

  const fetchUsers = async () => {
    setLoading((prev) => ({ ...prev, users: true }));
    try {
      const res = await api.get("/users");
      const rows = res.data || [];
      setUsers(rows);

      if (user?.email) {
        const freshUser = rows.find((row) => row.email === user.email && row.role === user.role);
        if (freshUser && freshUser._id !== user._id) {
          localStorage.setItem("user", JSON.stringify(freshUser));
          setUser(freshUser);
        } else if (!freshUser) {
          localStorage.removeItem("user");
          setUser(null);
          setError("Your login session no longer exists. Please login again.");
        }
      }
    } catch (err) {
      setError(extractError(err, "Failed to load users."));
    } finally {
      setLoading((prev) => ({ ...prev, users: false }));
    }
  };

  const fetchFacultySubjects = async (course, semester) => {
    if (!user?._id) return;

    setLoading((prev) => ({ ...prev, subjects: true }));
    try {
      const params = new URLSearchParams({ facultyId: user._id });
      if (course) params.set("course", String(course).trim());
      if (semester) params.set("semester", String(Number(semester)));

      const res = await api.get(`/subjects?${params.toString()}`);
      const list = res.data || [];
      setSubjects(list);

      if (list.length > 0) {
        setAttendanceForm((prev) => ({ ...prev, subjectId: prev.subjectId || list[0]._id }));
        setMarksForm((prev) => ({ ...prev, subjectId: prev.subjectId || list[0]._id }));
        setClassForm((prev) => ({ ...prev, subjectId: prev.subjectId || list[0]._id }));
      } else {
        setAttendanceForm((prev) => ({ ...prev, subjectId: "" }));
        setMarksForm((prev) => ({ ...prev, subjectId: "" }));
        setClassForm((prev) => ({ ...prev, subjectId: "" }));
      }
    } catch (err) {
      setSubjects([]);
      setError(extractError(err, "Failed to load assigned subjects."));
    } finally {
      setLoading((prev) => ({ ...prev, subjects: false }));
    }
  };

  const fetchMyActivity = async () => {
    if (!user?._id || !supportsAggregateFetch) return;
    try {
      const [aRes, mRes] = await Promise.allSettled([api.get("/attendance"), api.get("/marks")]);
      const attendance404 =
        aRes.status === "rejected" && aRes.reason?.response?.status === 404;
      const marks404 = mRes.status === "rejected" && mRes.reason?.response?.status === 404;
      if (attendance404 || marks404) {
        setSupportsAggregateFetch(false);
        return;
      }
      const attendanceData = aRes.status === "fulfilled" ? aRes.value.data || [] : [];
      const marksData = mRes.status === "fulfilled" ? mRes.value.data || [] : [];
      setMyAttendance(attendanceData.filter((a) => a.teacherId === user._id));
      setMyMarks(marksData.filter((m) => m.teacherId === user._id));
    } catch {
      // non-blocking for faculty workflow
    }
  };

  const fetchFacultyModules = async () => {
    if (!user?._id) return;
    try {
      const [timetableRes, assignmentsRes, classRes, msgRes, noticesRes, deptRes, feeRes] = await Promise.all([
        api.get(`/timetables?facultyId=${user._id}`),
        api.get(`/assignments?facultyId=${user._id}`),
        api.get(`/class-sections`),
        api.get(`/messages?fromUserId=${user._id}`),
        api.get(`/notices`),
        api.get(`/departments`),
        api.get(`/semester-fees`)
      ]);
      setMyTimetable(sortTimetableSlots(timetableRes.data || []));
      setMyAssignments(assignmentsRes.data || []);
      setClassSections(classRes.data || []);
      setDepartments(deptRes.data || []);
      setSemesterFees(feeRes.data || []);
      setSentMessages(msgRes.data || []);
      const facultyClassIds = new Set(
        (timetableRes.data || []).map((slot) => String(slot.classSectionId?._id || slot.classSectionId || ""))
      );
      setNotices(
        (noticesRes.data || []).filter((n) => {
          if (n.audience === "all" || n.audience === "faculty") return true;
          if (n.audience !== "class") return false;
          return facultyClassIds.has(String(n.classSectionId?._id || n.classSectionId || ""));
        })
      );
    } catch {
      // soft-fail to keep panel usable
    }
  };

  const fetchFaceClasses = async () => {
    if (!user?._id) return;
    try {
      const res = await api.get(
        `/timetable/current?role=faculty&userId=${user._id}&today=true`
      );
      const classes = res?.data?.classes || [];
      setFaceClasses(classes);
      setSelectedFaceClassId((prev) => {
        if (prev && classes.some((slot) => String(slot.id) === String(prev))) return prev;
        return classes[0]?.id || "";
      });
      if (classes.length === 0) {
        setLiveFaceAttendance([]);
        setLiveFaceStats({ presentCount: 0, absentCount: 0 });
      }
    } catch (err) {
      setError(extractError(err, "Failed to load today's face attendance classes."));
    }
  };

  const loadLiveFaceAttendance = async (timetableId) => {
    if (!timetableId) {
      setLiveFaceAttendance([]);
      setLiveFaceStats({ presentCount: 0, absentCount: 0 });
      return;
    }
    try {
      const res = await api.get(`/attendance/live?timetableId=${timetableId}`);
      setLiveFaceAttendance(res?.data?.students || []);
      setLiveFaceStats({
        presentCount: Number(res?.data?.presentCount || 0),
        absentCount: Number(res?.data?.absentCount || 0)
      });
    } catch (err) {
      setError(extractError(err, "Failed to load live attendance list."));
    }
  };

  const startFaceAttendanceSession = async (timetableId) => {
    if (!timetableId || !user?._id) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await api.post("/attendance/session/start", {
        facultyId: user._id,
        timetableId,
        windowMinutes: 10
      });
      setSuccess("Attendance session started.");
      await fetchFaceClasses();
      await loadLiveFaceAttendance(timetableId);
    } catch (err) {
      setError(extractError(err, "Failed to start attendance session."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMyActivity();
    fetchFacultySubjects();
    fetchFacultyModules();
    fetchFaceClasses();
  }, []);

  useEffect(() => {
    const student = students.find((s) => s._id === selectedStudent);
    if (student?.course && student?.semester) {
      setClassForm((prev) => ({
        ...prev,
        course: student.course,
        semester: Number(student.semester)
      }));
      fetchFacultySubjects(student.course, student.semester);
    }
  }, [selectedStudent, students]);

  useEffect(() => {
    fetchFacultySubjects(classForm.course, classForm.semester);
  }, [classForm.course, classForm.semester]);

  useEffect(() => {
    const nextStatus = {};
    const nextMarks = {};
    for (const s of classStudents) {
      nextStatus[s._id] = bulkStatusMap[s._id] || "present";
      nextMarks[s._id] = bulkMarksMap[s._id] ?? "";
    }
    setBulkStatusMap(nextStatus);
    setBulkMarksMap(nextMarks);
  }, [classStudents]);

  useEffect(() => {
    if (selectedFaceClassId) {
      loadLiveFaceAttendance(selectedFaceClassId);
    }
  }, [selectedFaceClassId]);

  useEffect(() => {
    if (activeTab !== "faceSession") return undefined;
    fetchFaceClasses();
    if (selectedFaceClassId) {
      loadLiveFaceAttendance(selectedFaceClassId);
    }
    const timer = setInterval(() => {
      fetchFaceClasses();
      if (selectedFaceClassId) loadLiveFaceAttendance(selectedFaceClassId);
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab, selectedFaceClassId]);

  const markSingleAttendance = async () => {
    if (!selectedStudent || !attendanceForm.subjectId || !attendanceForm.date) {
      setError("Select student, assigned subject and date.");
      return;
    }
    if (!user?._id) {
      setError("Please login again.");
      return;
    }
    const selectedSubject = subjects.find((s) => s._id === attendanceForm.subjectId);
    if (!selectedSubject) {
      setError("Please select a valid assigned subject.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await postAttendanceCompat({
        studentId: selectedStudent,
        subjectId: attendanceForm.subjectId,
        subject: selectedSubject.name,
        status: attendanceForm.status,
        date: attendanceForm.date,
        teacherId: user._id
      });
      setSuccess("Attendance marked.");
      fetchMyActivity();
    } catch (err) {
      setError(extractError(err, "Failed to mark attendance."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const addSingleMarks = async () => {
    const parsed = Number(marksForm.score);
    if (!selectedStudent || !marksForm.subjectId || Number.isNaN(parsed)) {
      setError("Select student, assigned subject and valid marks.");
      return;
    }
    if (parsed < 0 || parsed > 100) {
      setError("Marks must be between 0 and 100.");
      return;
    }
    const selectedSubject = subjects.find((s) => s._id === marksForm.subjectId);
    if (!selectedSubject) {
      setError("Please select a valid assigned subject.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await postMarksCompat({
        studentId: selectedStudent,
        subjectId: marksForm.subjectId,
        subject: selectedSubject.name,
        marks: parsed,
        teacherId: user._id
      });
      setMarksForm((prev) => ({ ...prev, score: "" }));
      setSuccess("Marks added.");
      fetchMyActivity();
    } catch (err) {
      setError(extractError(err, "Failed to add marks."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const submitBulkAttendance = async () => {
    if (!classForm.subjectId || !classForm.date) {
      setError("Set assigned subject and date.");
      return;
    }
    const selectedSubject = subjects.find((s) => s._id === classForm.subjectId);
    if (!selectedSubject) {
      setError("Please select a valid assigned subject.");
      return;
    }
    const records = classStudents.map((s) => ({
      studentId: s._id,
      subjectId: classForm.subjectId,
      subject: selectedSubject.name,
      date: classForm.date,
      status: bulkStatusMap[s._id] || "present",
      teacherId: user?._id
    }));

    if (records.length === 0) {
      setError("No class students found.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      try {
        await api.post("/attendance/bulk", { records });
      } catch (err) {
        if (err?.response?.status === 404) {
          await Promise.all(records.map((row) => postAttendanceCompat(row)));
        } else {
          throw err;
        }
      }
      setSuccess(`Bulk attendance submitted for ${records.length} students.`);
      fetchMyActivity();
    } catch (err) {
      setError(extractError(err, "Bulk attendance failed."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const submitBulkMarks = async () => {
    if (!classForm.subjectId) {
      setError("Set assigned subject first.");
      return;
    }
    const selectedSubject = subjects.find((s) => s._id === classForm.subjectId);
    if (!selectedSubject) {
      setError("Please select a valid assigned subject.");
      return;
    }

    const records = classStudents
      .map((s) => ({
        studentId: s._id,
        subjectId: classForm.subjectId,
        subject: selectedSubject.name,
        marks: Number(bulkMarksMap[s._id]),
        teacherId: user?._id
      }))
      .filter((r) => !Number.isNaN(r.marks));

    if (records.length === 0) {
      setError("Enter marks for at least one student.");
      return;
    }

    if (records.some((r) => r.marks < 0 || r.marks > 100)) {
      setError("Marks should be 0 to 100.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      try {
        await api.post("/marks/bulk", { records });
      } catch (err) {
        if (err?.response?.status === 404) {
          await Promise.all(records.map((row) => postMarksCompat(row)));
        } else {
          throw err;
        }
      }
      setSuccess(`Bulk marks submitted for ${records.length} students.`);
      fetchMyActivity();
    } catch (err) {
      setError(extractError(err, "Bulk marks failed."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const createAssignment = async () => {
    if (!assignmentForm.title || !assignmentForm.subjectId || !assignmentForm.dueDate) {
      setError("Title, subject and due date are required.");
      return;
    }

    try {
      await api.post("/assignments", {
        ...assignmentForm,
        facultyId: user?._id
      });
      setAssignmentForm({
        title: "",
        description: "",
        subjectId: "",
        classSectionId: "",
        dueDate: ""
      });
      setSuccess("Assignment published.");
      fetchFacultyModules();
    } catch (err) {
      setError(extractError(err, "Failed to publish assignment."));
    }
  };

  const sendFacultyMessage = async () => {
    if (!messageForm.content.trim()) {
      setError("Message content is required.");
      return;
    }
    if (!messageForm.toUserId && !messageForm.classSectionId) {
      setError("Select a student or class section.");
      return;
    }

    try {
      await api.post("/messages", {
        fromUserId: user?._id,
        toUserId: messageForm.toUserId || undefined,
        classSectionId: messageForm.classSectionId || undefined,
        content: messageForm.content.trim(),
        isBroadcast: Boolean(messageForm.isBroadcast)
      });
      setMessageForm({ toUserId: "", classSectionId: "", content: "", isBroadcast: false });
      setSuccess("Message sent.");
      fetchFacultyModules();
    } catch (err) {
      setError(extractError(err, "Failed to send message."));
    }
  };

  const selectFacultyStudentByRoll = () => {
    const roll = attendanceRollQuery.trim().toUpperCase();
    if (!roll) {
      setError("Enter a class roll number.");
      return;
    }
    const student = students.find((s) => String(s.rollNumber || "").toUpperCase() === roll);
    if (!student) {
      setError("No student found with that class roll number.");
      return;
    }
    setSelectedStudent(student._id);
    setSuccess(`Selected ${student.name} (${student.rollNumber || "No Roll"})`);
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "students", label: "Students" },
    { key: "schedule", label: "Schedule" },
    { key: "faceSession", label: "Face Session" },
    { key: "attendance", label: "Attendance" },
    { key: "marks", label: "Marks" },
    { key: "assignments", label: "Assignments" },
    { key: "communication", label: "Communication" }
  ];

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <h2>Faculty Panel</h2>
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
            <h1>Faculty Dashboard</h1>
            <p>
              Welcome {user?.name || "Faculty"} ({user?.designation || "Faculty Member"})
            </p>
          </div>
        </header>

        {notice.message ? (
          <div className={`notice ${notice.type}`} role="alert">
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice({ type: "", message: "" })}>
              Dismiss
            </button>
          </div>
        ) : null}

        {activeTab === "overview" && (
          <section className="panel-grid stats-grid">
            <article className="panel card-strong">
              <h3>Total Students</h3>
              <p>{students.length}</p>
            </article>
            <article className="panel card-strong">
              <h3>Total Classes</h3>
              <p>{classCount}</p>
            </article>
            <article className="panel card-strong">
              <h3>My Attendance Entries</h3>
              <p>{myAttendance.length}</p>
            </article>
            <article className="panel card-strong">
              <h3>My Marks Entries</h3>
              <p>{myMarks.length}</p>
            </article>
            <article className="panel card-strong">
              <h3>Avg Marks Posted</h3>
              <p>{avgPostedMarks}</p>
            </article>
          </section>
        )}

        {activeTab === "students" && (
          <section className="panel-stack">
            <article className="panel">
              <div className="split-head">
                <h3>Student Directory</h3>
                <input
                  placeholder="Search student"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="list-wrap">
                {loading.users ? (
                  <p>Loading students...</p>
                ) : filteredStudents.length === 0 ? (
                  <p>No students found.</p>
                ) : (
                  filteredStudents.map((s) => (
                    <div className="list-item" key={s._id}>
                      <div>
                        <strong>{s.name}</strong>
                        <p>
                          {s.email} | Class Roll: {s.rollNumber || "NA"} | Univ Roll: {s.universityRollNumber || "NA"} | {s.course || "NA"} - Sem {s.semester || "NA"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === "schedule" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>My Timetable</h2>
              <div className="table-wrap">
                {myTimetable.length === 0 ? (
                  <p>No timetable slots assigned.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTimetable.map((slot) => (
                        <tr key={slot._id}>
                          <td>{slot.dayOfWeek}</td>
                          <td>{slot.startTime} - {slot.endTime}</td>
                          <td>{slot.subjectId?.name || "Subject"}</td>
                          <td>{slot.classSectionId?.name || "Class"}</td>
                          <td>{slot.room || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === "faceSession" && (
          <section className="panel-stack">
            <article className="panel">
              <div className="split-head">
                <div>
                  <h2>Face Attendance Session</h2>
                  <p className="helper-text">
                    Start a live session for a class scheduled today. Students can mark face attendance while the session is active.
                  </p>
                </div>
                <button type="button" className="secondary-btn" onClick={fetchFaceClasses}>
                  Refresh
                </button>
              </div>

              <div className="list-wrap">
                {faceClasses.length === 0 ? (
                  <p>No classes scheduled for you today.</p>
                ) : (
                  faceClasses.map((slot) => {
                    const isActive = Boolean(slot?.session?.isActive);
                    const canStart = Boolean(slot.isClassRunning && !isActive);
                    return (
                      <div className="list-item" key={slot.id}>
                        <div>
                          <strong>{slot.subject?.name || "Subject"}</strong>
                          <p>
                            {slot.classSection?.name || "Class"} | {slot.startTime} - {slot.endTime}
                            {slot.room ? ` | Room ${slot.room}` : ""}
                          </p>
                          <p>
                            {isActive
                              ? `Session active until ${new Date(slot.session.endAt).toLocaleTimeString()}`
                              : slot.isClassRunning
                                ? "Class is running. You can start attendance now."
                                : "Session can be started only during class time."}
                          </p>
                        </div>
                        <div className="action-row">
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => {
                              setSelectedFaceClassId(slot.id);
                              loadLiveFaceAttendance(slot.id);
                            }}
                          >
                            View Live
                          </button>
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={() => startFaceAttendanceSession(slot.id)}
                            disabled={!canStart || loading.action}
                          >
                            {isActive ? "Session Active" : "Start Session"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <article className="panel">
              <div className="split-head">
                <div>
                  <h3>Live Attendance</h3>
                  <p className="helper-text">
                    {selectedFaceClass
                      ? `${selectedFaceClass.subject?.name || "Subject"} | ${selectedFaceClass.startTime}-${selectedFaceClass.endTime}`
                      : "Select a class to view live attendance."}
                  </p>
                </div>
                <select
                  value={selectedFaceClassId}
                  onChange={(e) => setSelectedFaceClassId(e.target.value)}
                >
                  <option value="">Select Class</option>
                  {faceClasses.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.subject?.name || "Subject"} | {slot.startTime}-{slot.endTime}
                    </option>
                  ))}
                </select>
              </div>

              <section className="panel-grid stats-grid">
                <article className="panel card-strong">
                  <h3>Present</h3>
                  <p>{liveFaceStats.presentCount}</p>
                </article>
                <article className="panel card-strong">
                  <h3>Absent</h3>
                  <p>{liveFaceStats.absentCount}</p>
                </article>
                <article className="panel card-strong">
                  <h3>Total</h3>
                  <p>{liveFaceStats.presentCount + liveFaceStats.absentCount}</p>
                </article>
              </section>

              <div className="list-wrap">
                {!selectedFaceClassId ? (
                  <p>Select a class to load students.</p>
                ) : liveFaceAttendance.length === 0 ? (
                  <p>No enrolled students found for this class.</p>
                ) : (
                  liveFaceAttendance.map((row) => (
                    <div className="list-item" key={row.studentId}>
                      <div>
                        <strong>{row.name}</strong>
                        <p>
                          Class Roll: {row.rollNumber || "NA"} | Univ Roll:{" "}
                          {row.universityRollNumber || "NA"}
                        </p>
                        <p>
                          {row.markedAt
                            ? `Marked at ${new Date(row.markedAt).toLocaleTimeString()}`
                            : "Not marked yet"}
                        </p>
                      </div>
                      <span className={`status-pill ${row.status === "present" ? "success" : "muted"}`}>
                        {row.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>

            {myTimetable.length > 0 ? (
              <article className="panel">
                <h3>Weekly Assigned Timetable</h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTimetable.map((slot) => (
                        <tr key={slot._id}>
                          <td>{slot.dayOfWeek}</td>
                          <td>{slot.startTime} - {slot.endTime}</td>
                          <td>{slot.subjectId?.name || "Subject"}</td>
                          <td>{slot.classSectionId?.name || "Class"}</td>
                          <td>{slot.room || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ) : null}
          </section>
        )}

        {activeTab === "attendance" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Single Attendance</h2>
              <div className="form-grid">
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {(s.rollNumber ? `${s.rollNumber} - ` : "") + s.name}
                    </option>
                  ))}
                </select>
                <div className="inline-field">
                  <input
                    placeholder="Find by Class Roll Number"
                    value={attendanceRollQuery}
                    onChange={(e) => setAttendanceRollQuery(e.target.value.toUpperCase())}
                  />
                  <button type="button" className="secondary-btn" onClick={selectFacultyStudentByRoll}>
                    Find
                  </button>
                </div>
                <input
                  type="date"
                  value={attendanceForm.date}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, date: e.target.value }))}
                />
                <select
                  value={attendanceForm.subjectId}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, subjectId: e.target.value }))}
                >
                  <option value="">Assigned Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.course} - Sem {s.semester})
                    </option>
                  ))}
                </select>
                <select
                  value={attendanceForm.status}
                  onChange={(e) => setAttendanceForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              {subjects.length === 0 ? (
                <p className="helper-text">
                  No assigned subjects found for this class/faculty. Ask admin to assign subjects first.
                </p>
              ) : null}
              <button
                type="button"
                className="primary-btn"
                onClick={markSingleAttendance}
                disabled={!canFacultyMarkAttendance || loading.action}
              >
                {loading.action ? "Saving..." : "Mark Attendance"}
              </button>
            </article>

            <article className="panel">
              <h2>Bulk Attendance (Class)</h2>
              <div className="form-grid">
                <select
                  value={classForm.course}
                  onChange={(e) => setClassForm((p) => ({ ...p, course: e.target.value }))}
                >
                  <option value="">Select Course</option>
                  {courseOptions.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="12"
                  placeholder="Semester"
                  value={classForm.semester}
                  onChange={(e) => setClassForm((p) => ({ ...p, semester: Number(e.target.value || 1) }))}
                />
                <select
                  value={classForm.subjectId}
                  onChange={(e) => setClassForm((p) => ({ ...p, subjectId: e.target.value }))}
                >
                  <option value="">Assigned Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.course} - Sem {s.semester})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={classForm.date}
                  onChange={(e) => setClassForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="list-wrap">
                {classStudents.length === 0 ? (
                  <p>No class students found.</p>
                ) : (
                  classStudents.map((s) => (
                    <div className="list-item" key={s._id}>
                      <strong>{s.name}</strong>
                      <select
                        value={bulkStatusMap[s._id] || "present"}
                        onChange={(e) =>
                          setBulkStatusMap((prev) => ({ ...prev, [s._id]: e.target.value }))
                        }
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
              <button type="button" className="primary-btn" onClick={submitBulkAttendance}>
                Submit Bulk Attendance
              </button>
            </article>
          </section>
        )}

        {activeTab === "marks" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Single Marks Entry</h2>
              <div className="form-grid">
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {(s.rollNumber ? `${s.rollNumber} - ` : "") + s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={marksForm.subjectId}
                  onChange={(e) => setMarksForm((p) => ({ ...p, subjectId: e.target.value }))}
                >
                  <option value="">Assigned Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.course} - Sem {s.semester})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Marks"
                  value={marksForm.score}
                  onChange={(e) => setMarksForm((p) => ({ ...p, score: e.target.value }))}
                />
              </div>
              <button type="button" className="primary-btn" onClick={addSingleMarks}>
                Add Marks
              </button>
            </article>

            <article className="panel">
              <h2>Bulk Marks (Class)</h2>
              <div className="form-grid">
                <select
                  value={classForm.course}
                  onChange={(e) => setClassForm((p) => ({ ...p, course: e.target.value }))}
                >
                  <option value="">Select Course</option>
                  {courseOptions.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="12"
                  placeholder="Semester"
                  value={classForm.semester}
                  onChange={(e) => setClassForm((p) => ({ ...p, semester: Number(e.target.value || 1) }))}
                />
                <select
                  value={classForm.subjectId}
                  onChange={(e) => setClassForm((p) => ({ ...p, subjectId: e.target.value }))}
                >
                  <option value="">Assigned Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.course} - Sem {s.semester})
                    </option>
                  ))}
                </select>
              </div>
              <div className="list-wrap">
                {classStudents.length === 0 ? (
                  <p>No class students found.</p>
                ) : (
                  classStudents.map((s) => (
                    <div className="list-item" key={s._id}>
                      <strong>{s.name}</strong>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Marks"
                        value={bulkMarksMap[s._id] ?? ""}
                        onChange={(e) =>
                          setBulkMarksMap((prev) => ({ ...prev, [s._id]: e.target.value }))
                        }
                      />
                    </div>
                  ))
                )}
              </div>
              <button type="button" className="primary-btn" onClick={submitBulkMarks}>
                Submit Bulk Marks
              </button>
            </article>
          </section>
        )}

        {activeTab === "assignments" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Publish Assignment</h2>
              <div className="form-grid">
                <input
                  placeholder="Title"
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm((p) => ({ ...p, title: e.target.value }))}
                />
                <select
                  value={assignmentForm.subjectId}
                  onChange={(e) => setAssignmentForm((p) => ({ ...p, subjectId: e.target.value }))}
                >
                  <option value="">Assigned Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.course} - Sem {s.semester})
                    </option>
                  ))}
                </select>
                <select
                  value={assignmentForm.classSectionId}
                  onChange={(e) =>
                    setAssignmentForm((p) => ({ ...p, classSectionId: e.target.value }))
                  }
                >
                  <option value="">Class Section (Optional)</option>
                  {classSections.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
                <input
                  placeholder="Description"
                  value={assignmentForm.description}
                  onChange={(e) =>
                    setAssignmentForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
              <button type="button" className="primary-btn" onClick={createAssignment}>
                Publish Assignment
              </button>
            </article>
            <article className="panel">
              <h2>My Assignments</h2>
              <div className="list-wrap">
                {myAssignments.length === 0 ? (
                  <p>No assignments published.</p>
                ) : (
                  myAssignments.map((a) => (
                    <div className="list-item" key={a._id}>
                      <div>
                        <strong>{a.title}</strong>
                        <p>{a.subjectId?.name || "Subject"} | Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                        <p>{a.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === "communication" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Notices, Events & Workshops</h2>
              <div className="list-wrap">
                {notices.length === 0 ? (
                  <p>No notices.</p>
                ) : (
                  notices.map((n) => (
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
                  ))
                )}
              </div>
            </article>
            <article className="panel">
              <h2>Send Message</h2>
              <div className="form-grid">
                <select
                  value={messageForm.toUserId}
                  onChange={(e) => setMessageForm((p) => ({ ...p, toUserId: e.target.value }))}
                >
                  <option value="">Select Student (Optional)</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {(s.rollNumber ? `${s.rollNumber} - ` : "") + s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={messageForm.classSectionId}
                  onChange={(e) =>
                    setMessageForm((p) => ({ ...p, classSectionId: e.target.value }))
                  }
                >
                  <option value="">Class Section (Optional)</option>
                  {classSections.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Message Content"
                  value={messageForm.content}
                  onChange={(e) => setMessageForm((p) => ({ ...p, content: e.target.value }))}
                />
              </div>
              <button type="button" className="primary-btn" onClick={sendFacultyMessage}>
                Send Message
              </button>
            </article>
            <article className="panel">
              <h2>Sent Messages</h2>
              <div className="list-wrap">
                {sentMessages.length === 0 ? (
                  <p>No sent messages.</p>
                ) : (
                  sentMessages.map((m) => (
                    <div className="list-item" key={m._id}>
                      <div>
                        <strong>{m.toUserId?.name || m.classSectionId?.name || "Broadcast"}</strong>
                        <p>{m.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

export default FacultyDashboard;
