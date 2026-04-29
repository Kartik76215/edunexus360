import { useEffect, useMemo, useState } from "react";
import api from "./lib/api";
import "./Dashboard.css";
import AdminModules from "./AdminModules";
import FaceEnrollmentPage from "./FaceEnrollmentPage";
import { buildCourseOptions } from "./lib/courses";

const createEmptyUserForm = () => ({
  name: "",
  email: "",
  password: "",
  role: "student",
  designation: "",
  course: "",
  semester: 1,
  section: "",
  rollNumber: "",
  universityRollNumber: ""
});

const createEmptySubjectForm = () => ({
  course: "",
  semester: 1,
  name: "",
  facultyId: ""
});

const createEmptyAttendanceForm = () => ({
  subject: "",
  status: "present",
  date: ""
});

const createEmptyMarksForm = () => ({
  subject: "",
  score: ""
});

const createBulkAttendanceForm = () => ({
  course: "",
  semester: 1,
  subject: "",
  date: "",
  defaultStatus: "present"
});

const createBulkMarksForm = () => ({
  course: "",
  semester: 1,
  subject: ""
});

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const sectionOptions = ["A", "B", "C", "D"];

const getStudentSection = (student) => {
  if (student.section) return String(student.section).trim().toUpperCase();

  const emailSection = String(student.email || "").match(/\.s\d+\.([a-z])\./i)?.[1];
  if (emailSection) return emailSection.toUpperCase();

  const rollIndex = Number(String(student.rollNumber || "").match(/-(\d+)$/)?.[1]);
  if (Number.isFinite(rollIndex) && rollIndex > 0) {
    return String.fromCharCode(65 + Math.floor((rollIndex - 1) / 20));
  }

  return "NA";
};

const getStudentGroupLabel = (student) =>
  `${student.course || "NA"} | Sem ${student.semester || "NA"} | Section ${getStudentSection(student)}`;

const compareStudents = (a, b) =>
  collator.compare(a.course || "", b.course || "") ||
  Number(a.semester || 0) - Number(b.semester || 0) ||
  collator.compare(getStudentSection(a), getStudentSection(b)) ||
  collator.compare(a.rollNumber || "", b.rollNumber || "") ||
  collator.compare(a.name || "", b.name || "");

const groupStudents = (studentRows) =>
  studentRows.reduce((groups, student) => {
    const label = getStudentGroupLabel(student);
    if (!groups.some((group) => group.label === label)) {
      groups.push({ label, students: [] });
    }
    groups.find((group) => group.label === label).students.push(student);
    return groups;
  }, []);

function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);

  const [selectedStudent, setSelectedStudent] = useState("");

  const [userForm, setUserForm] = useState(createEmptyUserForm);
  const [subjectForm, setSubjectForm] = useState(createEmptySubjectForm);
  const [attendanceForm, setAttendanceForm] = useState(createEmptyAttendanceForm);
  const [marksForm, setMarksForm] = useState(createEmptyMarksForm);
  const [bulkAttendanceForm, setBulkAttendanceForm] = useState(createBulkAttendanceForm);
  const [bulkMarksForm, setBulkMarksForm] = useState(createBulkMarksForm);

  const [studentSearch, setStudentSearch] = useState("");
  const [facultySearch, setFacultySearch] = useState("");
  const [attendanceRollQuery, setAttendanceRollQuery] = useState("");
  const [allAttendance, setAllAttendance] = useState([]);
  const [allMarks, setAllMarks] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [bulkAttendanceMap, setBulkAttendanceMap] = useState({});
  const [bulkMarksMap, setBulkMarksMap] = useState({});

  const [loading, setLoading] = useState({
    users: false,
    subjects: false,
    attendance: false,
    marks: false,
    reports: false,
    action: false
  });

  const [notice, setNotice] = useState({ type: "", message: "" });
  const [canFetchAllSubjects, setCanFetchAllSubjects] = useState(true);

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const students = useMemo(
    () => users.filter((u) => u.role === "student").sort(compareStudents),
    [users]
  );

  const faculty = useMemo(
    () => users.filter((u) => u.role === "faculty"),
    [users]
  );

  const courseOptions = useMemo(() => {
    return buildCourseOptions({ departments, users, subjects, classSections, timetables });
  }, [departments, users, subjects, classSections, timetables]);

  const selectedStudentData = useMemo(
    () => students.find((u) => u._id === selectedStudent) || null,
    [students, selectedStudent]
  );

  const classStudentsForBulkAttendance = useMemo(
    () =>
      students.filter(
        (s) =>
          String(s.course || "").trim().toLowerCase() ===
            String(bulkAttendanceForm.course || "").trim().toLowerCase() &&
          Number(s.semester) === Number(bulkAttendanceForm.semester)
      ).sort(compareStudents),
    [students, bulkAttendanceForm.course, bulkAttendanceForm.semester]
  );

  const classStudentsForBulkMarks = useMemo(
    () =>
      students.filter(
        (s) =>
          String(s.course || "").trim().toLowerCase() ===
            String(bulkMarksForm.course || "").trim().toLowerCase() &&
          Number(s.semester) === Number(bulkMarksForm.semester)
      ).sort(compareStudents),
    [students, bulkMarksForm.course, bulkMarksForm.semester]
  );

  const dashboardStats = useMemo(() => {
    const averageMarks =
      marks.length > 0
        ? (marks.reduce((sum, item) => sum + Number(item.marks || 0), 0) / marks.length).toFixed(1)
        : "0.0";

    const attendancePresent = attendance.filter((item) => item.status === "present").length;
    const attendancePercent =
      attendance.length > 0 ? ((attendancePresent / attendance.length) * 100).toFixed(1) : "0.0";

    return {
      totalUsers: users.length,
      totalStudents: students.length,
      totalFaculty: faculty.length,
      totalSubjects: subjects.length,
      averageMarks,
      attendancePercent
    };
  }, [users.length, students.length, faculty.length, subjects.length, marks, attendance]);

  const studentPerformanceRows = useMemo(() => {
    const byStudent = {};
    for (const item of allMarks) {
      if (!byStudent[item.studentId]) byStudent[item.studentId] = { total: 0, count: 0 };
      byStudent[item.studentId].total += Number(item.marks || 0);
      byStudent[item.studentId].count += 1;
    }

    return Object.entries(byStudent)
      .map(([studentId, agg]) => {
        const student = students.find((u) => u._id === studentId);
        return {
          studentId,
          name: student?.name || "Unknown Student",
          average: (agg.total / agg.count).toFixed(1),
          exams: agg.count
        };
      })
      .sort((a, b) => Number(b.average) - Number(a.average))
      .slice(0, 10);
  }, [allMarks, students]);

  const subjectPerformanceRows = useMemo(() => {
    const bySubject = {};
    for (const item of allMarks) {
      if (!bySubject[item.subject]) bySubject[item.subject] = { total: 0, count: 0 };
      bySubject[item.subject].total += Number(item.marks || 0);
      bySubject[item.subject].count += 1;
    }

    return Object.entries(bySubject)
      .map(([subject, agg]) => ({
        subject,
        average: (agg.total / agg.count).toFixed(1),
        attempts: agg.count
      }))
      .sort((a, b) => Number(b.average) - Number(a.average));
  }, [allMarks]);

  const attendanceBreakdown = useMemo(() => {
    const present = allAttendance.filter((a) => a.status === "present").length;
    const absent = allAttendance.filter((a) => a.status === "absent").length;
    const total = allAttendance.length;
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";

    return { present, absent, total, rate };
  }, [allAttendance]);

  const atRiskStudents = useMemo(() => {
    const marksAgg = {};
    for (const item of allMarks) {
      if (!marksAgg[item.studentId]) marksAgg[item.studentId] = { total: 0, count: 0 };
      marksAgg[item.studentId].total += Number(item.marks || 0);
      marksAgg[item.studentId].count += 1;
    }

    const attendanceAgg = {};
    for (const item of allAttendance) {
      if (!attendanceAgg[item.studentId]) attendanceAgg[item.studentId] = { total: 0, present: 0 };
      attendanceAgg[item.studentId].total += 1;
      if (item.status === "present") attendanceAgg[item.studentId].present += 1;
    }

    return students
      .map((student) => {
        const m = marksAgg[student._id] || { total: 0, count: 0 };
        const a = attendanceAgg[student._id] || { total: 0, present: 0 };
        const avgMarks = m.count > 0 ? m.total / m.count : null;
        const attendancePct = a.total > 0 ? (a.present / a.total) * 100 : null;
        const isAtRisk =
          (avgMarks !== null && avgMarks < 40) || (attendancePct !== null && attendancePct < 75);

        return {
          id: student._id,
          name: student.name,
          avgMarks: avgMarks !== null ? avgMarks.toFixed(1) : "NA",
          attendancePct: attendancePct !== null ? attendancePct.toFixed(1) : "NA",
          isAtRisk
        };
      })
      .filter((row) => row.isAtRisk)
      .sort((a, b) => Number(a.attendancePct === "NA" ? 101 : a.attendancePct) - Number(b.attendancePct === "NA" ? 101 : b.attendancePct));
  }, [allMarks, allAttendance, students]);

  const setSuccess = (message) => setNotice({ type: "success", message });
  const setError = (message) => setNotice({ type: "error", message });

  const extractError = (err, fallback) =>
    err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

  const postAttendanceCompat = async (payload) => {
    try {
      return await api.post(`/attendance`, payload);
    } catch (err) {
      const status = err?.response?.status;
      if ((status === 400 || status === 404) && payload.subject) {
        const legacy = {
          studentId: payload.studentId,
          subject: payload.subject,
          status: payload.status,
          date: payload.date,
          teacherId: payload.teacherId
        };
        return api.post(`/attendance`, legacy);
      }
      throw err;
    }
  };

  const postMarksCompat = async (payload) => {
    try {
      return await api.post(`/marks`, payload);
    } catch (err) {
      const status = err?.response?.status;
      if ((status === 400 || status === 404) && payload.subject) {
        const legacy = {
          studentId: payload.studentId,
          subject: payload.subject,
          marks: payload.marks,
          teacherId: payload.teacherId
        };
        return api.post(`/marks`, legacy);
      }
      throw err;
    }
  };

  const fetchUsers = async () => {
    setLoading((prev) => ({ ...prev, users: true }));
    try {
      const res = await api.get(`/users`);
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

  const fetchDepartments = async () => {
    try {
      const [departmentsRes, sectionsRes, timetablesRes] = await Promise.allSettled([
        api.get(`/departments`),
        api.get(`/class-sections`),
        api.get(`/timetables`)
      ]);
      setDepartments(departmentsRes.status === "fulfilled" ? departmentsRes.value.data || [] : []);
      setClassSections(sectionsRes.status === "fulfilled" ? sectionsRes.value.data || [] : []);
      setTimetables(timetablesRes.status === "fulfilled" ? timetablesRes.value.data || [] : []);
    } catch (err) {
      setError(extractError(err, "Failed to load course list."));
    }
  };

  const fetchSubjects = async (course, semester) => {
    if (!course || !semester) {
      setSubjects([]);
      return;
    }

    setLoading((prev) => ({ ...prev, subjects: true }));
    try {
      const res = await api.get(`/subjects/${encodeURIComponent(course)}/${semester}`);
      setSubjects(res.data || []);
    } catch (err) {
      setError(extractError(err, "Failed to load subjects."));
      setSubjects([]);
    } finally {
      setLoading((prev) => ({ ...prev, subjects: false }));
    }
  };

  const fetchAllSubjects = async () => {
    if (!canFetchAllSubjects) return;

    setLoading((prev) => ({ ...prev, subjects: true }));
    try {
      const res = await api.get(`/subjects`);
      setSubjects(res.data || []);
    } catch (err) {
      if (err?.response?.status === 404) {
        setCanFetchAllSubjects(false);
      } else {
        setError(extractError(err, "Failed to load subjects."));
      }
      setSubjects([]);
    } finally {
      setLoading((prev) => ({ ...prev, subjects: false }));
    }
  };

  const loadSubjectsForCurrentContext = async () => {
    const student = students.find((u) => u._id === selectedStudent);
    const course = (student?.course || subjectForm.course || "").trim();
    const semester = Number(student?.semester || subjectForm.semester);

    if (!course || !semester) {
      if (canFetchAllSubjects) {
        await fetchAllSubjects();
      }
      return;
    }

    setSubjectForm((prev) => ({ ...prev, course, semester }));
    await fetchSubjects(course, semester);
  };

  const fetchStudentAttendance = async (studentId) => {
    if (!studentId) {
      setAttendance([]);
      return;
    }

    setLoading((prev) => ({ ...prev, attendance: true }));
    try {
      const res = await api.get(`/attendance/${studentId}`);
      setAttendance(res.data || []);
    } catch (err) {
      setError(extractError(err, "Failed to load attendance."));
      setAttendance([]);
    } finally {
      setLoading((prev) => ({ ...prev, attendance: false }));
    }
  };

  const fetchStudentMarks = async (studentId) => {
    if (!studentId) {
      setMarks([]);
      return;
    }

    setLoading((prev) => ({ ...prev, marks: true }));
    try {
      const res = await api.get(`/marks/${studentId}`);
      setMarks(res.data || []);
    } catch (err) {
      setError(extractError(err, "Failed to load marks."));
      setMarks([]);
    } finally {
      setLoading((prev) => ({ ...prev, marks: false }));
    }
  };

  const fetchReportsData = async () => {
    setLoading((prev) => ({ ...prev, reports: true }));
    try {
      const [attendanceRes, marksRes] = await Promise.allSettled([
        api.get(`/attendance`),
        api.get(`/marks`)
      ]);

      setAllAttendance(
        attendanceRes.status === "fulfilled" ? attendanceRes.value.data || [] : []
      );
      setAllMarks(marksRes.status === "fulfilled" ? marksRes.value.data || [] : []);
    } catch (err) {
      setError(extractError(err, "Failed to load reports data."));
    } finally {
      setLoading((prev) => ({ ...prev, reports: false }));
    }
  };

  const updateUserDetails = async () => {
    if (!editingUser?._id) return;
    if (
      editingUser.role === "student" &&
      (!String(editingUser.rollNumber || "").trim() ||
        !String(editingUser.universityRollNumber || "").trim())
    ) {
      setError("Class roll number and university roll number are required for students.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await api.put(`/users/${editingUser._id}`, {
        name: editingUser.name,
        role: editingUser.role,
        designation: editingUser.designation,
        course: editingUser.course,
        section: editingUser.role === "student" ? editingUser.section || "" : "",
        semester: Number(editingUser.semester) || 1,
        rollNumber: editingUser.rollNumber,
        universityRollNumber: editingUser.universityRollNumber
      });
      await fetchUsers();
      setEditingUser(null);
      setSuccess("User updated successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to update user."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const deleteSubject = async (id) => {
    if (!window.confirm("Delete this subject?")) return;

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await api.delete(`/subjects/${id}`);
      await fetchSubjects(subjectForm.course.trim(), Number(subjectForm.semester));
      setSuccess("Subject deleted successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to delete subject."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const exportRowsToCsv = (filename, headers, rows) => {
    const escapeValue = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const csv = [
      headers.map(escapeValue).join(","),
      ...rows.map((row) => row.map(escapeValue).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchSubjects(subjectForm.course.trim(), Number(subjectForm.semester));
  }, [subjectForm.course, subjectForm.semester]);

  useEffect(() => {
    if (!selectedStudent) {
      setAttendance([]);
      setMarks([]);
      setSubjects([]);
      setAttendanceForm((prev) => ({ ...prev, subject: "" }));
      setMarksForm((prev) => ({ ...prev, subject: "" }));
      return;
    }

    fetchStudentAttendance(selectedStudent);
    fetchStudentMarks(selectedStudent);

    const student = students.find((u) => u._id === selectedStudent);
    if (student?.course && student?.semester) {
      fetchSubjects(student.course, student.semester);
      setSubjectForm((prev) => ({
        ...prev,
        course: student.course,
        semester: Number(student.semester)
      }));
    } else {
      if (canFetchAllSubjects) {
        fetchAllSubjects();
      }
    }
  }, [selectedStudent, students, canFetchAllSubjects]);

  useEffect(() => {
    if (subjects.length === 0) {
      setAttendanceForm((prev) => ({ ...prev, subject: "" }));
      setMarksForm((prev) => ({ ...prev, subject: "" }));
      return;
    }

    setAttendanceForm((prev) => {
      const subjectExists = subjects.some((s) => s._id === prev.subject);
      return subjectExists ? prev : { ...prev, subject: subjects[0]._id };
    });

    setMarksForm((prev) => {
      const subjectExists = subjects.some((s) => s._id === prev.subject);
      return subjectExists ? prev : { ...prev, subject: subjects[0]._id };
    });
  }, [subjects]);

  useEffect(() => {
    if (activeTab === "reports") {
      fetchReportsData();
    }
  }, [activeTab]);

  useEffect(() => {
    setBulkAttendanceMap((prev) => {
      const next = {};
      for (const student of classStudentsForBulkAttendance) {
        next[student._id] = prev[student._id] || bulkAttendanceForm.defaultStatus;
      }
      return next;
    });
  }, [classStudentsForBulkAttendance, bulkAttendanceForm.defaultStatus]);

  useEffect(() => {
    setBulkMarksMap((prev) => {
      const next = {};
      for (const student of classStudentsForBulkMarks) {
        next[student._id] = prev[student._id] ?? "";
      }
      return next;
    });
  }, [classStudentsForBulkMarks]);

  const addUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password) {
      setError("Name, email and password are required.");
      return;
    }

    if (userForm.role === "faculty" && !userForm.designation.trim()) {
      setError("Designation is required for faculty.");
      return;
    }

    if (
      userForm.role === "student" &&
      (!userForm.rollNumber.trim() || !String(userForm.universityRollNumber || "").trim())
    ) {
      setError("Class roll number and university roll number are required for students.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await api.post(`/users`, {
        ...userForm,
        semester: Number(userForm.semester)
      });
      await fetchUsers();
      setUserForm(createEmptyUserForm());
      setSuccess("User added successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to add user."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const deleteUser = async (id) => {
    const ok = window.confirm("Delete this user?");
    if (!ok) return;

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await api.delete(`/users/${id}`);
      await fetchUsers();

      if (selectedStudent === id) {
        setSelectedStudent("");
      }

      setSuccess("User deleted successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to delete user."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const addSubject = async () => {
    if (!subjectForm.course.trim() || !subjectForm.name.trim() || !subjectForm.facultyId) {
      setError("Course, subject name and faculty are required.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await api.post(`/subjects`, {
        ...subjectForm,
        course: subjectForm.course.trim(),
        name: subjectForm.name.trim(),
        semester: Number(subjectForm.semester),
        facultyId: subjectForm.facultyId
      });

      await fetchSubjects(subjectForm.course.trim(), Number(subjectForm.semester));
      setSubjectForm((prev) => ({ ...prev, name: "" }));
      setSuccess("Subject added successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to add subject."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const markAttendance = async () => {
    if (!selectedStudent || !attendanceForm.subject || !attendanceForm.date) {
      setError("Select student, date and subject before marking attendance.");
      return;
    }

    if (!user?._id) {
      setError("Logged-in user is missing. Please login again.");
      return;
    }

    const selectedSubject = subjects.find((s) => s._id === attendanceForm.subject);
    if (!selectedSubject) {
      setError("Please select a valid subject.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await postAttendanceCompat({
        studentId: selectedStudent,
        status: attendanceForm.status,
        date: attendanceForm.date,
        teacherId: user._id,
        subjectId: selectedSubject._id,
        subject: selectedSubject.name
      });

      await fetchStudentAttendance(selectedStudent);
      setSuccess("Attendance marked successfully.");
    } catch (err) {
      if (err?.response?.status === 403) {
        setError("You are not allowed to mark attendance for this subject.");
      } else {
        setError(extractError(err, "Failed to mark attendance."));
      }
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const addMarks = async () => {
    if (!selectedStudent || !marksForm.subject || !marksForm.score) {
      setError("Select student, subject and score before adding marks.");
      return;
    }

    const parsed = Number(marksForm.score);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setError("Marks must be a number between 0 and 100.");
      return;
    }

    if (!user?._id) {
      setError("Logged-in user is missing. Please login again.");
      return;
    }

    const selectedSubject = subjects.find((s) => s._id === marksForm.subject);
    if (!selectedSubject) {
      setError("Please select a valid subject.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await postMarksCompat({
        studentId: selectedStudent,
        subjectId: selectedSubject._id,
        subject: selectedSubject.name,
        marks: parsed,
        teacherId: user._id
      });

      await fetchStudentMarks(selectedStudent);
      setMarksForm((prev) => ({ ...prev, score: "" }));
      setSuccess("Marks added successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to add marks."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const applyDefaultBulkAttendance = () => {
    if (classStudentsForBulkAttendance.length === 0) {
      setError("No students found for selected class.");
      return;
    }

    const next = {};
    for (const student of classStudentsForBulkAttendance) {
      next[student._id] = bulkAttendanceForm.defaultStatus;
    }
    setBulkAttendanceMap(next);
  };

  const submitBulkAttendance = async () => {
    if (!bulkAttendanceForm.subject || !bulkAttendanceForm.date) {
      setError("Bulk attendance needs subject and date.");
      return;
    }
    if (!user?._id) {
      setError("Logged-in user is missing. Please login again.");
      return;
    }

    const selectedSubject = subjects.find((s) => s._id === bulkAttendanceForm.subject);
    if (!selectedSubject) {
      setError("Please select a valid subject for bulk attendance.");
      return;
    }

    const records = classStudentsForBulkAttendance
      .map((student) => ({
        studentId: student._id,
        subjectId: bulkAttendanceForm.subject,
        subject: selectedSubject.name,
        date: bulkAttendanceForm.date,
        status: bulkAttendanceMap[student._id] || bulkAttendanceForm.defaultStatus,
        teacherId: user._id
      }))
      .filter((row) => row.status === "present" || row.status === "absent");

    if (records.length === 0) {
      setError("No attendance records to submit.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      try {
        await api.post(`/attendance/bulk`, { records });
      } catch (err) {
        if (err?.response?.status === 404) {
          await Promise.all(records.map((row) => postAttendanceCompat(row)));
        } else {
          throw err;
        }
      }
      setSuccess(`Bulk attendance marked for ${records.length} students.`);
      if (selectedStudent) await fetchStudentAttendance(selectedStudent);
    } catch (err) {
      setError(extractError(err, "Failed to submit bulk attendance."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const submitBulkMarks = async () => {
    if (!bulkMarksForm.subject) {
      setError("Bulk marks needs a subject.");
      return;
    }
    if (!user?._id) {
      setError("Logged-in user is missing. Please login again.");
      return;
    }

    const selectedSubject = subjects.find((s) => s._id === bulkMarksForm.subject);
    if (!selectedSubject) {
      setError("Please select a valid subject for bulk marks.");
      return;
    }

    const records = classStudentsForBulkMarks
      .map((student) => ({
        studentId: student._id,
        subjectId: bulkMarksForm.subject,
        subject: selectedSubject.name,
        marks: Number(bulkMarksMap[student._id]),
        teacherId: user._id
      }))
      .filter((row) => !Number.isNaN(row.marks));

    if (records.length === 0) {
      setError("Enter marks for at least one student.");
      return;
    }

    const invalid = records.some((r) => r.marks < 0 || r.marks > 100);
    if (invalid) {
      setError("Each mark must be between 0 and 100.");
      return;
    }

    setLoading((prev) => ({ ...prev, action: true }));
    try {
      try {
        await api.post(`/marks/bulk`, { records });
      } catch (err) {
        if (err?.response?.status === 404) {
          await Promise.all(records.map((row) => postMarksCompat(row)));
        } else {
          throw err;
        }
      }
      setSuccess(`Bulk marks submitted for ${records.length} students.`);
      if (selectedStudent) await fetchStudentMarks(selectedStudent);
    } catch (err) {
      setError(extractError(err, "Failed to submit bulk marks."));
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  const studentFiltered = students.filter((u) =>
    [u.name, u.email, u.rollNumber, u.universityRollNumber, u.course, getStudentSection(u)]
      .join(" ")
      .toLowerCase()
      .includes(studentSearch.toLowerCase().trim())
  );

  const groupedStudentFiltered = groupStudents(studentFiltered);
  const groupedStudents = groupStudents(students);

  const facultyFiltered = faculty.filter((u) =>
    u.name.toLowerCase().includes(facultySearch.toLowerCase().trim())
  );

  const canMarkSingleAttendance = Boolean(
    selectedStudent && attendanceForm.subject && attendanceForm.date
  );

  const selectStudentByRoll = () => {
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
    { key: "dashboard", label: "Dashboard" },
    { key: "users", label: "Users" },
    { key: "subjects", label: "Subjects" },
    { key: "attendance", label: "Attendance" },
    { key: "marks", label: "Marks" },
    { key: "reports", label: "Reports" },
    { key: "institution", label: "Institution" },
    { key: "faceEnrollment", label: "Face Enrollment" }
  ];

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <h2>EduNexus</h2>

        <nav className="tab-list">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
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
            <h1>Academic Dashboard</h1>
            <p>
              Welcome {user?.name || "User"} ({user?.role || "unknown role"})
            </p>
          </div>

          <div className="context-pill">
            {selectedStudentData
              ? `${selectedStudentData.name} | ${selectedStudentData.course || "NA"} - Sem ${
                  selectedStudentData.semester || "NA"
                } | Section ${getStudentSection(selectedStudentData)}`
              : "No student selected"}
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

        {activeTab === "dashboard" && (
          <section className="panel-grid stats-grid">
            <article className="panel card-strong">
              <h3>Total Users</h3>
              <p>{dashboardStats.totalUsers}</p>
            </article>
            <article className="panel card-strong">
              <h3>Students</h3>
              <p>{dashboardStats.totalStudents}</p>
            </article>
            <article className="panel card-strong">
              <h3>Faculty</h3>
              <p>{dashboardStats.totalFaculty}</p>
            </article>
            <article className="panel card-strong">
              <h3>Subjects (Current Context)</h3>
              <p>{dashboardStats.totalSubjects}</p>
            </article>
            <article className="panel card-strong">
              <h3>Avg Marks (Selected Student)</h3>
              <p>{dashboardStats.averageMarks}</p>
            </article>
            <article className="panel card-strong">
              <h3>Attendance % (Selected Student)</h3>
              <p>{dashboardStats.attendancePercent}%</p>
            </article>
          </section>
        )}

        {activeTab === "users" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Add User</h2>
              <div className="form-grid">
                <input
                  placeholder="Name"
                  value={userForm.name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  placeholder="Email"
                  value={userForm.email}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                </select>

                {userForm.role === "faculty" && (
                  <input
                    placeholder="Designation"
                    value={userForm.designation}
                    onChange={(e) =>
                      setUserForm((prev) => ({ ...prev, designation: e.target.value }))
                    }
                  />
                )}

                <select
                  value={userForm.course}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, course: e.target.value }))}
                >
                  <option value="">Select Course</option>
                  {courseOptions.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
                {userForm.role === "student" && (
                  <select
                    value={userForm.section}
                    onChange={(e) =>
                      setUserForm((prev) => ({ ...prev, section: e.target.value }))
                    }
                  >
                    <option value="">Select Section</option>
                    {sectionOptions.map((section) => (
                      <option key={section} value={section}>Section {section}</option>
                    ))}
                  </select>
                )}
                {userForm.role === "student" && (
                  <input
                    placeholder="Class Roll Number"
                    value={userForm.rollNumber}
                    onChange={(e) =>
                      setUserForm((prev) => ({ ...prev, rollNumber: e.target.value.toUpperCase() }))
                    }
                  />
                )}
                {userForm.role === "student" && (
                  <input
                    placeholder="University Roll Number"
                    value={userForm.universityRollNumber || ""}
                    onChange={(e) =>
                      setUserForm((prev) => ({
                        ...prev,
                        universityRollNumber: e.target.value.toUpperCase()
                      }))
                    }
                  />
                )}
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={userForm.semester}
                  onChange={(e) =>
                    setUserForm((prev) => ({ ...prev, semester: Number(e.target.value || 1) }))
                  }
                />
              </div>

              <button
                type="button"
                className="primary-btn"
                onClick={addUser}
                disabled={loading.action}
              >
                {loading.action ? "Saving..." : "Add User"}
              </button>
            </article>

            {editingUser && (
              <article className="panel">
                <h2>Edit User</h2>
                <div className="form-grid">
                  <input
                    placeholder="Name"
                    value={editingUser.name || ""}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                  <select
                    value={editingUser.role || "student"}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, role: e.target.value }))
                    }
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                  <input
                    placeholder="Designation"
                    value={editingUser.designation || ""}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, designation: e.target.value }))
                    }
                  />
                  <select
                    value={editingUser.course || ""}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, course: e.target.value }))
                    }
                  >
                    <option value="">Select Course</option>
                    {courseOptions.map((course) => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                  {editingUser.role === "student" && (
                    <select
                      value={editingUser.section || ""}
                      onChange={(e) =>
                        setEditingUser((prev) => ({ ...prev, section: e.target.value }))
                      }
                    >
                      <option value="">Select Section</option>
                      {sectionOptions.map((section) => (
                        <option key={section} value={section}>Section {section}</option>
                      ))}
                    </select>
                  )}
                  {editingUser.role === "student" && (
                    <input
                      placeholder="Class Roll Number"
                      value={editingUser.rollNumber || ""}
                      onChange={(e) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          rollNumber: e.target.value.toUpperCase()
                        }))
                      }
                    />
                  )}
                  {editingUser.role === "student" && (
                    <input
                      placeholder="University Roll Number"
                      value={editingUser.universityRollNumber || ""}
                      onChange={(e) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          universityRollNumber: e.target.value.toUpperCase()
                        }))
                      }
                    />
                  )}
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={editingUser.semester || 1}
                    onChange={(e) =>
                      setEditingUser((prev) => ({
                        ...prev,
                        semester: Number(e.target.value || 1)
                      }))
                    }
                  />
                </div>
                <div className="action-row">
                  <button type="button" className="primary-btn" onClick={updateUserDetails}>
                    Save Changes
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setEditingUser(null)}>
                    Cancel
                  </button>
                </div>
              </article>
            )}

            <article className="panel">
              <div className="split-head">
                <h3>Students</h3>
                <input
                  placeholder="Search student"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
              <div className="list-wrap">
                {loading.users ? (
                  <p>Loading students...</p>
                ) : studentFiltered.length === 0 ? (
                  <p>No students found.</p>
                ) : (
                  groupedStudentFiltered.map((group) => (
                    <div className="student-group" key={group.label}>
                      <div className="list-section-heading">
                        <strong>{group.label}</strong>
                        <span>{group.students.length} students</span>
                      </div>
                      {group.students.map((u) => (
                        <div className="list-item" key={u._id}>
                          <div>
                            <strong>{u.name}</strong>
                        <p>
                              {u.email} | Section: {getStudentSection(u)} | Class Roll: {u.rollNumber || "NA"} | Univ Roll: {u.universityRollNumber || "NA"}
                        </p>
                          </div>
                          <div className="action-row">
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => setEditingUser({ ...u })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-btn"
                              onClick={() => deleteUser(u._id)}
                              disabled={loading.action}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="panel">
              <div className="split-head">
                <h3>Faculty</h3>
                <input
                  placeholder="Search faculty"
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
                />
              </div>
              <div className="list-wrap">
                {loading.users ? (
                  <p>Loading faculty...</p>
                ) : facultyFiltered.length === 0 ? (
                  <p>No faculty found.</p>
                ) : (
                  facultyFiltered.map((u) => (
                    <div className="list-item" key={u._id}>
                      <div>
                        <strong>{u.name}</strong>
                        <p>
                          {u.email} | {u.designation || "No designation"}
                        </p>
                      </div>
                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => setEditingUser({ ...u })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => deleteUser(u._id)}
                          disabled={loading.action}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === "subjects" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Manage Subjects</h2>
              <div className="form-grid">
                <select
                  value={subjectForm.course}
                  onChange={(e) =>
                    setSubjectForm((prev) => ({ ...prev, course: e.target.value }))
                  }
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
                  value={subjectForm.semester}
                  onChange={(e) =>
                    setSubjectForm((prev) => ({ ...prev, semester: Number(e.target.value || 1) }))
                  }
                />
                <input
                  placeholder="Subject Name"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <select
                  value={subjectForm.facultyId}
                  onChange={(e) =>
                    setSubjectForm((prev) => ({ ...prev, facultyId: e.target.value }))
                  }
                >
                  <option value="">Assign Faculty</option>
                  {faculty.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} {f.designation ? `(${f.designation})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="primary-btn"
                onClick={addSubject}
                disabled={loading.action}
              >
                {loading.action ? "Saving..." : "Add Subject"}
              </button>
            </article>

            <article className="panel">
              <h3>Subject List</h3>
              <div className="list-wrap">
                {loading.subjects ? (
                  <p>Loading subjects...</p>
                ) : subjects.length === 0 ? (
                  <p>No subjects found for this course/semester.</p>
                ) : (
                  subjects.map((s) => (
                    <div className="list-item" key={s._id}>
                      <div>
                        <strong>{s.name}</strong>
                        <p>
                          {s.course} | Sem {s.semester} | Faculty: {s.facultyId?.name || "Unassigned"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => deleteSubject(s._id)}
                        disabled={loading.action}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === "attendance" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Mark Attendance</h2>
              <div className="form-grid">
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="">Select Student</option>
                  {groupedStudents.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.students.map((s) => (
                        <option key={s._id} value={s._id}>
                          {(s.rollNumber ? `${s.rollNumber} - ` : "") + s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div className="inline-field">
                  <input
                    placeholder="Find by Class Roll Number"
                    value={attendanceRollQuery}
                    onChange={(e) => setAttendanceRollQuery(e.target.value.toUpperCase())}
                  />
                  <button type="button" className="secondary-btn" onClick={selectStudentByRoll}>
                    Find
                  </button>
                </div>

                <input
                  type="date"
                  value={attendanceForm.date}
                  onChange={(e) =>
                    setAttendanceForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                />

                <select
                  value={subjectForm.course}
                  onChange={(e) =>
                    setSubjectForm((prev) => ({ ...prev, course: e.target.value }))
                  }
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
                  value={subjectForm.semester}
                  onChange={(e) =>
                    setSubjectForm((prev) => ({
                      ...prev,
                      semester: Number(e.target.value || 1)
                    }))
                  }
                />

                <select
                  value={attendanceForm.subject}
                  onChange={(e) =>
                    setAttendanceForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} {s.course ? `(${s.course} - Sem ${s.semester})` : ""} {s.facultyId?.name ? `| ${s.facultyId.name}` : ""}
                    </option>
                  ))}
                </select>

                <select
                  value={attendanceForm.status}
                  onChange={(e) =>
                    setAttendanceForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <p className="helper-text">
                Refresh Subject List loads subjects for the selected student's class (or entered course/semester).
              </p>
              <button type="button" className="primary-btn" onClick={loadSubjectsForCurrentContext}>
                Refresh Subject List
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={markAttendance}
                disabled={loading.action || !canMarkSingleAttendance}
              >
                {loading.action ? "Saving..." : "Mark Attendance"}
              </button>
            </article>

            <article className="panel">
              <h3>Bulk Attendance (Class-wise)</h3>
              <div className="form-grid">
                <select
                  value={bulkAttendanceForm.course}
                  onChange={(e) =>
                    setBulkAttendanceForm((prev) => ({ ...prev, course: e.target.value }))
                  }
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
                  value={bulkAttendanceForm.semester}
                  onChange={(e) =>
                    setBulkAttendanceForm((prev) => ({
                      ...prev,
                      semester: Number(e.target.value || 1)
                    }))
                  }
                />
                <select
                  value={bulkAttendanceForm.subject}
                  onChange={(e) =>
                    setBulkAttendanceForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.course} - Sem {s.semester})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={bulkAttendanceForm.date}
                  onChange={(e) =>
                    setBulkAttendanceForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
                <select
                  value={bulkAttendanceForm.defaultStatus}
                  onChange={(e) =>
                    setBulkAttendanceForm((prev) => ({ ...prev, defaultStatus: e.target.value }))
                  }
                >
                  <option value="present">Default Present</option>
                  <option value="absent">Default Absent</option>
                </select>
              </div>
              <div className="action-row">
                <button type="button" className="secondary-btn" onClick={applyDefaultBulkAttendance}>
                  Apply Default
                </button>
                <button type="button" className="primary-btn" onClick={submitBulkAttendance}>
                  Submit Bulk Attendance
                </button>
              </div>
              <div className="list-wrap">
                {classStudentsForBulkAttendance.length === 0 ? (
                  <p>No students found in this class.</p>
                ) : (
                  classStudentsForBulkAttendance.map((student) => (
                    <div className="list-item" key={student._id}>
                      <div>
                        <strong>{student.name}</strong>
                        <p>
                          {student.rollNumber || "No Roll"} | Section {getStudentSection(student)}
                        </p>
                      </div>
                      <select
                        value={bulkAttendanceMap[student._id] || "present"}
                        onChange={(e) =>
                          setBulkAttendanceMap((prev) => ({
                            ...prev,
                            [student._id]: e.target.value
                          }))
                        }
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="panel">
              <h3>Attendance History</h3>
              <div className="list-wrap">
                {loading.attendance ? (
                  <p>Loading attendance...</p>
                ) : attendance.length === 0 ? (
                  <p>No attendance records available.</p>
                ) : (
                  attendance.map((a) => (
                    <div className="list-item" key={a._id}>
                      <div>
                        <strong>{a.subject}</strong>
                        <p>
                          {new Date(a.date).toLocaleDateString()} | {a.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === "marks" && (
          <section className="panel-stack">
            <article className="panel">
              <h2>Add Marks</h2>
              <div className="form-grid">
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="">Select Student</option>
                  {groupedStudents.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.students.map((s) => (
                        <option key={s._id} value={s._id}>
                          {(s.rollNumber ? `${s.rollNumber} - ` : "") + s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  value={marksForm.subject}
                  onChange={(e) => setMarksForm((prev) => ({ ...prev, subject: e.target.value }))}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} {s.course ? `(${s.course} - Sem ${s.semester})` : ""} {s.facultyId?.name ? `| ${s.facultyId.name}` : ""}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Marks (0-100)"
                  value={marksForm.score}
                  onChange={(e) => setMarksForm((prev) => ({ ...prev, score: e.target.value }))}
                />
              </div>

              <button type="button" className="primary-btn" onClick={loadSubjectsForCurrentContext}>
                Refresh Subject List
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={addMarks}
                disabled={loading.action}
              >
                {loading.action ? "Saving..." : "Add Marks"}
              </button>
            </article>

            <article className="panel">
              <h3>Bulk Marks Entry (Class-wise)</h3>
              <div className="form-grid">
                <select
                  value={bulkMarksForm.course}
                  onChange={(e) =>
                    setBulkMarksForm((prev) => ({ ...prev, course: e.target.value }))
                  }
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
                  value={bulkMarksForm.semester}
                  onChange={(e) =>
                    setBulkMarksForm((prev) => ({
                      ...prev,
                      semester: Number(e.target.value || 1)
                    }))
                  }
                />
                <select
                  value={bulkMarksForm.subject}
                  onChange={(e) =>
                    setBulkMarksForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.course} - Sem {s.semester})
                    </option>
                  ))}
                </select>
              </div>
              <div className="action-row">
                <button type="button" className="primary-btn" onClick={submitBulkMarks}>
                  Submit Bulk Marks
                </button>
              </div>
              <div className="list-wrap">
                {classStudentsForBulkMarks.length === 0 ? (
                  <p>No students found in this class.</p>
                ) : (
                  classStudentsForBulkMarks.map((student) => (
                    <div className="list-item" key={student._id}>
                      <div>
                        <strong>{student.name}</strong>
                        <p>
                          {student.rollNumber || "No Roll"} | Section {getStudentSection(student)}
                        </p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Marks"
                        value={bulkMarksMap[student._id] ?? ""}
                        onChange={(e) =>
                          setBulkMarksMap((prev) => ({
                            ...prev,
                            [student._id]: e.target.value
                          }))
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="panel">
              <h3>Marks History</h3>
              <div className="list-wrap">
                {loading.marks ? (
                  <p>Loading marks...</p>
                ) : marks.length === 0 ? (
                  <p>No marks records available.</p>
                ) : (
                  marks.map((m) => (
                    <div className="list-item" key={m._id}>
                      <div>
                        <strong>{m.subject}</strong>
                        <p>Score: {m.marks}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        )}

        {activeTab === "reports" && (
          <section className="panel-stack">
            <article className="panel">
              <div className="split-head">
                <h2>Admin Reports</h2>
                <button type="button" className="secondary-btn" onClick={fetchReportsData}>
                  Refresh
                </button>
              </div>
              <div className="panel-grid stats-grid">
                <article className="panel card-strong">
                  <h3>Total Attendance Records</h3>
                  <p>{attendanceBreakdown.total}</p>
                </article>
                <article className="panel card-strong">
                  <h3>Present</h3>
                  <p>{attendanceBreakdown.present}</p>
                </article>
                <article className="panel card-strong">
                  <h3>Absent</h3>
                  <p>{attendanceBreakdown.absent}</p>
                </article>
                <article className="panel card-strong">
                  <h3>Overall Attendance %</h3>
                  <p>{attendanceBreakdown.rate}%</p>
                </article>
                <article className="panel card-strong">
                  <h3>Total Marks Records</h3>
                  <p>{allMarks.length}</p>
                </article>
                <article className="panel card-strong">
                  <h3>Students With Scores</h3>
                  <p>{studentPerformanceRows.length}</p>
                </article>
              </div>
            </article>

            <article className="panel">
              <div className="split-head">
                <h3>Top Students By Average</h3>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    exportRowsToCsv(
                      "student-performance.csv",
                      ["Student", "Average", "Exams"],
                      studentPerformanceRows.map((row) => [row.name, row.average, row.exams])
                    )
                  }
                >
                  Export CSV
                </button>
              </div>
              {loading.reports ? (
                <p>Loading reports...</p>
              ) : studentPerformanceRows.length === 0 ? (
                <p>No marks data available.</p>
              ) : (
                <div className="list-wrap">
                  {studentPerformanceRows.map((row) => (
                    <div className="list-item" key={row.studentId}>
                      <div>
                        <strong>{row.name}</strong>
                        <p>
                          Average: {row.average} | Exams: {row.exams}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="split-head">
                <h3>Subject-wise Performance</h3>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    exportRowsToCsv(
                      "subject-performance.csv",
                      ["Subject", "Average", "Attempts"],
                      subjectPerformanceRows.map((row) => [row.subject, row.average, row.attempts])
                    )
                  }
                >
                  Export CSV
                </button>
              </div>
              {loading.reports ? (
                <p>Loading reports...</p>
              ) : subjectPerformanceRows.length === 0 ? (
                <p>No subject marks data available.</p>
              ) : (
                <div className="list-wrap">
                  {subjectPerformanceRows.map((row) => (
                    <div className="list-item" key={row.subject}>
                      <div>
                        <strong>{row.subject}</strong>
                        <p>
                          Average: {row.average} | Attempts: {row.attempts}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <h3>At-Risk Students</h3>
              <p>
                Criteria: Average marks below 40 or attendance below 75%.
              </p>
              <div className="list-wrap">
                {loading.reports ? (
                  <p>Loading risk analysis...</p>
                ) : atRiskStudents.length === 0 ? (
                  <p>No at-risk students found.</p>
                ) : (
                  atRiskStudents.map((row) => (
                    <div className="list-item" key={row.id}>
                      <div>
                        <strong>{row.name}</strong>
                        <p>
                          Avg Marks: {row.avgMarks} | Attendance: {row.attendancePct}%
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="panel">
              <div className="split-head">
                <h3>Export Raw Data</h3>
                <div className="action-row">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      exportRowsToCsv(
                        "users.csv",
                        ["Name", "Email", "Role", "Class Roll Number", "University Roll Number", "Course", "Semester", "Section", "Designation"],
                        users.map((u) => [
                          u.name,
                          u.email,
                          u.role,
                          u.rollNumber || "",
                          u.universityRollNumber || "",
                          u.course || "",
                          u.semester || "",
                          getStudentSection(u),
                          u.designation || ""
                        ])
                      )
                    }
                  >
                    Users CSV
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      exportRowsToCsv(
                        "attendance.csv",
                        ["StudentId", "Subject", "Status", "Date"],
                        allAttendance.map((a) => [
                          a.studentId,
                          a.subject,
                          a.status,
                          new Date(a.date).toLocaleDateString()
                        ])
                      )
                    }
                  >
                    Attendance CSV
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      exportRowsToCsv(
                        "marks.csv",
                        ["StudentId", "Subject", "Marks"],
                        allMarks.map((m) => [m.studentId, m.subject, m.marks])
                      )
                    }
                  >
                    Marks CSV
                  </button>
                </div>
              </div>
            </article>
          </section>
        )}
        {activeTab === "institution" && <AdminModules />}
        {activeTab === "faceEnrollment" && <FaceEnrollmentPage />}
      </main>
    </div>
  );
}

export default Dashboard;
