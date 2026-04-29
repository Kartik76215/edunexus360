import { useEffect, useMemo, useState } from "react";
import api from "./lib/api";

const emptySemesterFeeForm = {
  title: "Semester Fee",
  course: "",
  semester: 1,
  amount: "",
  dueDaysAfterIssue: 15
};

const emptyMailMergeForm = {
  course: "",
  semester: "",
  threshold: 75
};

const emptyClassSectionForm = {
  name: "",
  departmentId: "",
  semesterId: "",
  coordinatorId: "",
  capacity: 60
};

const emptyTimetableForm = {
  classSectionId: "",
  subjectId: "",
  facultyId: "",
  dayOfWeek: "Mon",
  startTime: "",
  endTime: "",
  room: ""
};

function AdminModules() {
  const [departments, setDepartments] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [notices, setNotices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [semesterFees, setSemesterFees] = useState([]);
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [timetables, setTimetables] = useState([]);

  const [deptForm, setDeptForm] = useState({ name: "", code: "" });
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    body: "",
    audience: "all",
    noticeType: "notice",
    eventDate: "",
    imageData: "",
    imageName: ""
  });
  const [yearForm, setYearForm] = useState({ name: "", startDate: "", endDate: "" });
  const [semesterForm, setSemesterForm] = useState({
    name: "",
    number: 1,
    academicYearId: "",
    startDate: "",
    endDate: ""
  });
  const [semesterFeeForm, setSemesterFeeForm] = useState(emptySemesterFeeForm);
  const [mailMergeForm, setMailMergeForm] = useState(emptyMailMergeForm);
  const [classSectionForm, setClassSectionForm] = useState(emptyClassSectionForm);
  const [timetableForm, setTimetableForm] = useState(emptyTimetableForm);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeModule, setActiveModule] = useState("academic");

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const facultyUsers = useMemo(
    () => users.filter((u) => u.role === "faculty"),
    [users]
  );

  const courseOptions = useMemo(() => {
    const values = new Set();
    departments.forEach((department) => {
      if (department.code) values.add(String(department.code).trim().toUpperCase());
    });
    users.forEach((row) => {
      if (row.course) values.add(String(row.course).trim().toUpperCase());
    });
    subjects.forEach((row) => {
      if (row.course) values.add(String(row.course).trim().toUpperCase());
    });
    semesterFees.forEach((row) => {
      if (row.course) values.add(String(row.course).trim().toUpperCase());
    });
    return [...values].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [departments, users, subjects, semesterFees]);

  const showErr = (e, fallback = "Failed.") =>
    setMsg(e?.response?.data?.message || e?.response?.data?.error || fallback);

  const postWithRouteFallback = async (paths, payload) => {
    let lastError = null;
    for (const path of paths) {
      try {
        return await api.post(path, payload);
      } catch (e) {
        lastError = e;
        if (e?.response?.status !== 404) throw e;
      }
    }
    throw lastError || new Error("Route not found");
  };

  const load = async () => {
    setLoading(true);
    try {
      const [d, a, n, f, p, y, sem, sf, u, s, cs, tt] = await Promise.all([
        api.get("/departments"),
        api.get("/admissions"),
        api.get("/notices"),
        api.get("/fee-invoices"),
        api.get("/payrolls"),
        api.get("/academic-years"),
        api.get("/semesters"),
        api.get("/semester-fees"),
        api.get("/users"),
        api.get("/subjects"),
        api.get("/class-sections"),
        api.get("/timetables")
      ]);
      setDepartments(d.data || []);
      setAdmissions(a.data || []);
      setNotices(n.data || []);
      setInvoices(f.data || []);
      setPayrolls(p.data || []);
      setYears(y.data || []);
      setSemesters(sem.data || []);
      setSemesterFees(sf.data || []);
      setUsers(u.data || []);
      setSubjects(s.data || []);
      setClassSections(cs.data || []);
      setTimetables(tt.data || []);
    } catch (e) {
      showErr(e, "Failed to load institution modules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const selectedSubject = subjects.find((s) => s._id === timetableForm.subjectId);
    const facultyId = selectedSubject?.facultyId?._id || selectedSubject?.facultyId || "";
    if (facultyId && String(facultyId) !== String(timetableForm.facultyId)) {
      setTimetableForm((prev) => ({ ...prev, facultyId: String(facultyId) }));
    }
  }, [timetableForm.subjectId, subjects, timetableForm.facultyId]);

  const createDepartment = async () => {
    try {
      await api.post("/departments", deptForm);
      setDeptForm({ name: "", code: "" });
      setMsg("Department added.");
      load();
    } catch (e) {
      showErr(e);
    }
  };

  const createNotice = async () => {
    try {
      await api.post("/notices", { ...noticeForm, createdBy: user?._id });
      setNoticeForm({
        title: "",
        body: "",
        audience: "all",
        noticeType: "notice",
        eventDate: "",
        imageData: "",
        imageName: ""
      });
      setMsg("Notice posted.");
      load();
    } catch (e) {
      showErr(e);
    }
  };

  const handleNoticeImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setNoticeForm((p) => ({ ...p, imageData: "", imageName: "" }));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMsg("Please upload an image file for the event photo.");
      event.target.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMsg("Please upload an image smaller than 3 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNoticeForm((p) => ({
        ...p,
        imageData: String(reader.result || ""),
        imageName: file.name
      }));
    };
    reader.onerror = () => setMsg("Failed to read the selected image.");
    reader.readAsDataURL(file);
  };

  const createAcademicYear = async () => {
    try {
      await api.post("/academic-years", yearForm);
      setYearForm({ name: "", startDate: "", endDate: "" });
      setMsg("Academic year added.");
      load();
    } catch (e) {
      showErr(e);
    }
  };

  const createSemester = async () => {
    try {
      await api.post("/semesters", { ...semesterForm, number: Number(semesterForm.number) });
      setSemesterForm({ name: "", number: 1, academicYearId: "", startDate: "", endDate: "" });
      setMsg("Semester added.");
      load();
    } catch (e) {
      showErr(e);
    }
  };

  const createSemesterFee = async () => {
    if (!semesterFeeForm.course.trim()) {
      setMsg("Course is required for semester fee.");
      return;
    }
    if (Number(semesterFeeForm.amount) <= 0) {
      setMsg("Amount should be greater than 0.");
      return;
    }

    try {
      await api.post("/semester-fees", {
        title: semesterFeeForm.title.trim() || "Semester Fee",
        course: semesterFeeForm.course.trim(),
        semester: Number(semesterFeeForm.semester),
        amount: Number(semesterFeeForm.amount),
        dueDaysAfterIssue: Number(semesterFeeForm.dueDaysAfterIssue || 15)
      });
      setSemesterFeeForm(emptySemesterFeeForm);
      setMsg("Semester fee setup saved.");
      load();
    } catch (e) {
      showErr(e);
    }
  };

  const toggleSemesterFee = async (row) => {
    try {
      await api.put(`/semester-fees/${row._id}`, { active: !row.active });
      setMsg(`Semester fee ${!row.active ? "activated" : "deactivated"}.`);
      load();
    } catch (e) {
      showErr(e);
    }
  };

  const generateInvoices = async (semesterFeeId) => {
    try {
      const res = await api.post("/fee-invoices/generate", { semesterFeeId });
      setMsg(res?.data?.message || "Invoices generated.");
      load();
    } catch (e) {
      showErr(e, "Failed to generate invoices.");
    }
  };

  const sendFeeMailMerge = async () => {
    if (!user?._id) {
      setMsg("Please login again.");
      return;
    }
    try {
      const payload = { fromUserId: user._id };
      if (mailMergeForm.course.trim()) payload.course = mailMergeForm.course.trim();
      if (String(mailMergeForm.semester).trim()) payload.semester = Number(mailMergeForm.semester);
      const res = await postWithRouteFallback(
        ["/messages/mail-merge/fees", "/messages/mailmerge/fees"],
        payload
      );
      setMsg(res?.data?.message || "Fee reminders sent.");
      load();
    } catch (e) {
      showErr(e, "Failed to send fee reminders.");
    }
  };

  const sendAttendanceMailMerge = async () => {
    if (!user?._id) {
      setMsg("Please login again.");
      return;
    }
    try {
      const payload = {
        fromUserId: user._id,
        threshold: Number(mailMergeForm.threshold || 75)
      };
      if (mailMergeForm.course.trim()) payload.course = mailMergeForm.course.trim();
      if (String(mailMergeForm.semester).trim()) payload.semester = Number(mailMergeForm.semester);
      const res = await postWithRouteFallback(
        ["/messages/mail-merge/attendance", "/messages/mailmerge/attendance"],
        payload
      );
      setMsg(res?.data?.message || "Attendance alerts sent.");
      load();
    } catch (e) {
      showErr(e, "Failed to send attendance alerts.");
    }
  };

  const createClassSection = async () => {
    if (!classSectionForm.name.trim() || !classSectionForm.departmentId || !classSectionForm.semesterId) {
      setMsg("Class section name, department and semester are required.");
      return;
    }

    try {
      await api.post("/class-sections", {
        ...classSectionForm,
        name: classSectionForm.name.trim(),
        capacity: Number(classSectionForm.capacity || 60)
      });
      setClassSectionForm(emptyClassSectionForm);
      setMsg("Class section added.");
      load();
    } catch (e) {
      showErr(e, "Failed to create class section.");
    }
  };

  const createTimetableSlot = async () => {
    if (
      !timetableForm.classSectionId ||
      !timetableForm.subjectId ||
      !timetableForm.facultyId ||
      !timetableForm.dayOfWeek ||
      !timetableForm.startTime ||
      !timetableForm.endTime
    ) {
      setMsg("Class section, subject, faculty, day and time are required.");
      return;
    }

    if (timetableForm.startTime >= timetableForm.endTime) {
      setMsg("End time must be after start time.");
      return;
    }

    const overlapping = timetables.find(
      (slot) =>
        String(slot.classSectionId?._id || slot.classSectionId) === timetableForm.classSectionId &&
        slot.dayOfWeek === timetableForm.dayOfWeek &&
        timetableForm.startTime < slot.endTime &&
        timetableForm.endTime > slot.startTime
    );
    if (overlapping) {
      setMsg("This class section already has an overlapping slot in the selected time.");
      return;
    }

    try {
      await api.post("/timetables", {
        ...timetableForm,
        room: timetableForm.room.trim()
      });
      setTimetableForm(emptyTimetableForm);
      setMsg("Timetable slot created.");
      load();
    } catch (e) {
      showErr(e, "Failed to create timetable slot.");
    }
  };

  const deleteTimetableSlot = async (id) => {
    const ok = window.confirm("Delete this timetable slot?");
    if (!ok) return;
    try {
      await api.delete(`/timetables/${id}`);
      setMsg("Timetable slot deleted.");
      load();
    } catch (e) {
      showErr(e, "Failed to delete timetable slot.");
    }
  };

  const pendingFeeAmount = invoices
    .filter((x) => x.status !== "paid")
    .reduce((s, x) => s + Number(x.balanceAmount ?? Number(x.amount || 0) - Number(x.paidAmount || 0)), 0);

  const stats = {
    admissionsNew: admissions.filter((x) => x.status === "new").length,
    feesPending: pendingFeeAmount,
    payrollPending: payrolls
      .filter((x) => x.status === "pending")
      .reduce((s, x) => s + Number(x.amount || 0), 0)
  };

  const moduleTabs = [
    { key: "academic", label: "Academic Setup" },
    { key: "sections", label: "Class Sections" },
    { key: "timetable", label: "Timetable" },
    { key: "fees", label: "Fees" },
    { key: "alerts", label: "Mail Alerts" },
    { key: "communication", label: "Communication" },
    { key: "admissions", label: "Admissions" }
  ];

  return (
    <section className="panel-stack">
      {msg ? (
        <div className="notice success">
          <span>{msg}</span>
        </div>
      ) : null}

      <article className="panel-grid stats-grid">
        <article className="panel card-strong"><h3>Courses</h3><p>{departments.length}</p></article>
        <article className="panel card-strong"><h3>New Admissions</h3><p>{stats.admissionsNew}</p></article>
        <article className="panel card-strong"><h3>Pending Fees</h3><p>{stats.feesPending.toFixed(2)}</p></article>
        <article className="panel card-strong"><h3>Pending Payroll</h3><p>{stats.payrollPending}</p></article>
      </article>

      <nav className="panel institution-nav" aria-label="Institution modules">
        {moduleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`module-tab ${activeModule === tab.key ? "active" : ""}`}
            onClick={() => setActiveModule(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeModule === "academic" && (
      <article className="panel">
        <h3>Academic Setup</h3>
        <div className="form-grid">
          <input
            placeholder="Course Name"
            value={deptForm.name}
            onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            placeholder="Course Code"
            value={deptForm.code}
            onChange={(e) => setDeptForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
          />
          <button className="primary-btn" type="button" onClick={createDepartment}>Add Course</button>
        </div>
        <div className="form-grid">
          <input
            placeholder="Academic Year (2026-27)"
            value={yearForm.name}
            onChange={(e) => setYearForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            type="date"
            value={yearForm.startDate}
            onChange={(e) => setYearForm((p) => ({ ...p, startDate: e.target.value }))}
          />
          <input
            type="date"
            value={yearForm.endDate}
            onChange={(e) => setYearForm((p) => ({ ...p, endDate: e.target.value }))}
          />
          <button className="primary-btn" type="button" onClick={createAcademicYear}>Add Year</button>
        </div>
        <div className="form-grid">
          <input
            placeholder="Semester Name"
            value={semesterForm.name}
            onChange={(e) => setSemesterForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            value={semesterForm.number}
            onChange={(e) => setSemesterForm((p) => ({ ...p, number: e.target.value }))}
          />
          <select
            value={semesterForm.academicYearId}
            onChange={(e) => setSemesterForm((p) => ({ ...p, academicYearId: e.target.value }))}
          >
            <option value="">Select Academic Year</option>
            {years.map((y) => (
              <option key={y._id} value={y._id}>{y.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={semesterForm.startDate}
            onChange={(e) => setSemesterForm((p) => ({ ...p, startDate: e.target.value }))}
          />
          <input
            type="date"
            value={semesterForm.endDate}
            onChange={(e) => setSemesterForm((p) => ({ ...p, endDate: e.target.value }))}
          />
          <button className="primary-btn" type="button" onClick={createSemester}>Add Semester</button>
        </div>
      </article>
      )}

      {activeModule === "sections" && (
      <article className="panel">
        <h3>Class Sections</h3>
        <div className="form-grid">
          <input
            placeholder="Class Section Name (eg: BCA A)"
            value={classSectionForm.name}
            onChange={(e) => setClassSectionForm((p) => ({ ...p, name: e.target.value }))}
          />
          <select
            value={classSectionForm.departmentId}
            onChange={(e) => setClassSectionForm((p) => ({ ...p, departmentId: e.target.value }))}
          >
            <option value="">Select Course</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
          <select
            value={classSectionForm.semesterId}
            onChange={(e) => setClassSectionForm((p) => ({ ...p, semesterId: e.target.value }))}
          >
            <option value="">Select Semester</option>
            {semesters.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} (No. {s.number})
              </option>
            ))}
          </select>
          <select
            value={classSectionForm.coordinatorId}
            onChange={(e) => setClassSectionForm((p) => ({ ...p, coordinatorId: e.target.value }))}
          >
            <option value="">Class Coordinator (Optional)</option>
            {facultyUsers.map((f) => (
              <option key={f._id} value={f._id}>{f.name}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            placeholder="Capacity"
            value={classSectionForm.capacity}
            onChange={(e) => setClassSectionForm((p) => ({ ...p, capacity: e.target.value }))}
          />
          <button className="primary-btn" type="button" onClick={createClassSection}>Add Class Section</button>
        </div>
      </article>
      )}

      {activeModule === "timetable" && (
      <article className="panel">
        <h3>Timetable Management</h3>
        <div className="form-grid">
          <select
            value={timetableForm.classSectionId}
            onChange={(e) => setTimetableForm((p) => ({ ...p, classSectionId: e.target.value }))}
          >
            <option value="">Select Class Section</option>
            {classSections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={timetableForm.subjectId}
            onChange={(e) => setTimetableForm((p) => ({ ...p, subjectId: e.target.value }))}
          >
            <option value="">Select Subject</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.course} - Sem {s.semester})
              </option>
            ))}
          </select>
          <select
            value={timetableForm.facultyId}
            onChange={(e) => setTimetableForm((p) => ({ ...p, facultyId: e.target.value }))}
          >
            <option value="">Select Faculty</option>
            {facultyUsers.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            value={timetableForm.dayOfWeek}
            onChange={(e) => setTimetableForm((p) => ({ ...p, dayOfWeek: e.target.value }))}
          >
            <option value="Mon">Mon</option>
            <option value="Tue">Tue</option>
            <option value="Wed">Wed</option>
            <option value="Thu">Thu</option>
            <option value="Fri">Fri</option>
            <option value="Sat">Sat</option>
          </select>
          <input
            type="time"
            value={timetableForm.startTime}
            onChange={(e) => setTimetableForm((p) => ({ ...p, startTime: e.target.value }))}
          />
          <input
            type="time"
            value={timetableForm.endTime}
            onChange={(e) => setTimetableForm((p) => ({ ...p, endTime: e.target.value }))}
          />
          <input
            placeholder="Room (optional)"
            value={timetableForm.room}
            onChange={(e) => setTimetableForm((p) => ({ ...p, room: e.target.value }))}
          />
          <button className="primary-btn" type="button" onClick={createTimetableSlot}>Add Timetable Slot</button>
        </div>

        <div className="list-wrap">
          {timetables.length === 0 ? (
            <p>No timetable slots yet.</p>
          ) : (
            timetables.map((slot) => (
              <div className="list-item" key={slot._id}>
                <div>
                  <strong>{slot.classSectionId?.name || "Class Section"}</strong>
                  <p>
                    {slot.dayOfWeek} | {slot.startTime} - {slot.endTime} {slot.room ? `| Room ${slot.room}` : ""}
                  </p>
                  <p>
                    {slot.subjectId?.name || "Subject"} | {slot.facultyId?.name || "Faculty"}
                  </p>
                </div>
                <button className="danger-btn" type="button" onClick={() => deleteTimetableSlot(slot._id)}>
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </article>
      )}

      {activeModule === "fees" && (
      <article className="panel">
        <h3>Semester Fee Setup</h3>
        <div className="form-grid">
          <input
            placeholder="Fee Title"
            value={semesterFeeForm.title}
            onChange={(e) => setSemesterFeeForm((p) => ({ ...p, title: e.target.value }))}
          />
          <select
            value={semesterFeeForm.course}
            onChange={(e) => setSemesterFeeForm((p) => ({ ...p, course: e.target.value }))}
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
            value={semesterFeeForm.semester}
            onChange={(e) => setSemesterFeeForm((p) => ({ ...p, semester: Number(e.target.value || 1) }))}
          />
          <input
            type="number"
            min="1"
            placeholder="Amount"
            value={semesterFeeForm.amount}
            onChange={(e) => setSemesterFeeForm((p) => ({ ...p, amount: e.target.value }))}
          />
          <input
            type="number"
            min="0"
            max="120"
            placeholder="Due Days After Issue"
            value={semesterFeeForm.dueDaysAfterIssue}
            onChange={(e) =>
              setSemesterFeeForm((p) => ({ ...p, dueDaysAfterIssue: Number(e.target.value || 0) }))
            }
          />
          <button className="primary-btn" type="button" onClick={createSemesterFee}>Save Fee Setup</button>
        </div>
        <div className="list-wrap">
          {semesterFees.length === 0 ? (
            <p>No semester fee setup found.</p>
          ) : (
            semesterFees.map((sf) => (
              <div className="list-item" key={sf._id}>
                <div>
                  <strong>{sf.title}</strong>
                  <p>
                    {sf.course} | Sem {sf.semester} | Amount: Rs {sf.amount} | Due +{sf.dueDaysAfterIssue}d |{" "}
                    {sf.active ? "Active" : "Inactive"}
                  </p>
                </div>
                <div className="action-row">
                  <button className="secondary-btn" type="button" onClick={() => toggleSemesterFee(sf)}>
                    {sf.active ? "Disable" : "Enable"}
                  </button>
                  <button className="primary-btn" type="button" onClick={() => generateInvoices(sf._id)}>
                    Generate Invoices
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
      )}

      {activeModule === "alerts" && (
      <article className="panel">
        <h3>Mail Merge Alerts</h3>
        <div className="form-grid">
          <select
            value={mailMergeForm.course}
            onChange={(e) => setMailMergeForm((p) => ({ ...p, course: e.target.value }))}
          >
            <option value="">All Courses</option>
            {courseOptions.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="12"
            placeholder="Semester (Optional)"
            value={mailMergeForm.semester}
            onChange={(e) => setMailMergeForm((p) => ({ ...p, semester: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            max="100"
            placeholder="Attendance Threshold %"
            value={mailMergeForm.threshold}
            onChange={(e) => setMailMergeForm((p) => ({ ...p, threshold: e.target.value }))}
          />
          <button className="secondary-btn" type="button" onClick={sendFeeMailMerge}>
            Send Fee Due Reminders
          </button>
          <button className="primary-btn" type="button" onClick={sendAttendanceMailMerge}>
            Send Below-75% Alerts
          </button>
        </div>
      </article>
      )}

      {activeModule === "communication" && (
      <article className="panel">
        <h3>Global Communication</h3>
        <div className="form-grid">
          <select
            value={noticeForm.noticeType}
            onChange={(e) => setNoticeForm((p) => ({ ...p, noticeType: e.target.value }))}
          >
            <option value="notice">General Notice</option>
            <option value="event">Event Information</option>
            <option value="workshop">Workshop Information</option>
          </select>
          <input
            placeholder="Title"
            value={noticeForm.title}
            onChange={(e) => setNoticeForm((p) => ({ ...p, title: e.target.value }))}
          />
          <select
            value={noticeForm.audience}
            onChange={(e) => setNoticeForm((p) => ({ ...p, audience: e.target.value }))}
          >
            <option value="all">All</option>
            <option value="students">Students</option>
            <option value="faculty">Faculty</option>
            <option value="staff">Staff</option>
          </select>
          {(noticeForm.noticeType === "event" || noticeForm.noticeType === "workshop") && (
            <input
              type="date"
              value={noticeForm.eventDate}
              onChange={(e) => setNoticeForm((p) => ({ ...p, eventDate: e.target.value }))}
            />
          )}
          <textarea
            placeholder="Information text"
            value={noticeForm.body}
            onChange={(e) => setNoticeForm((p) => ({ ...p, body: e.target.value }))}
            rows="3"
          />
          <input type="file" accept="image/*" onChange={handleNoticeImageChange} />
          <button className="primary-btn" type="button" onClick={createNotice}>
            Publish {noticeForm.noticeType === "notice" ? "Notice" : noticeForm.noticeType}
          </button>
        </div>
        {noticeForm.imageData ? (
          <div className="notice-preview">
            <img src={noticeForm.imageData} alt={noticeForm.imageName || "Selected event"} />
            <span>{noticeForm.imageName}</span>
          </div>
        ) : null}
        <p className="helper-text">Total notices published: {notices.length}</p>
      </article>
      )}

      {activeModule === "admissions" && (
      <article className="panel">
        <h3>Admissions Queue</h3>
        <div className="list-wrap">
          {loading ? (
            <p>Loading...</p>
          ) : admissions.length === 0 ? (
            <p>No admissions.</p>
          ) : (
            admissions.map((a) => (
              <div className="list-item" key={a._id}>
                <div>
                  <strong>{a.applicantName}</strong>
                  <p>{a.email} | {a.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
      )}
    </section>
  );
}

export default AdminModules;
