import express from "express";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import ClassSection from "../models/ClassSection.js";
import Enrollment from "../models/Enrollment.js";
import Subject from "../models/Subject.js";
import Timetable from "../models/Timetable.js";
import User from "../models/User.js";
import { dayLabel, todayDateKey } from "../utils/faceAttendance.js";

const router = express.Router();

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeCourse = (value) => String(value || "").trim().toLowerCase();

const inferClassSectionIdsForStudent = async (studentId) => {
  const student = await User.findById(studentId).select("course semester section");
  if (!student) return [];

  const course = String(student.course || "").trim().toUpperCase();
  const semester = Number(student.semester || 0);
  const section = String(student.section || "").trim().toUpperCase();

  if (!course || !semester) return [];

  const rows = await ClassSection.find({})
    .populate("departmentId", "code")
    .populate("semesterId", "number")
    .select("_id name departmentId semesterId");

  const sectionPattern = section
    ? new RegExp(`(?:^|[^A-Z0-9])${escapeRegex(section)}(?:$|[^A-Z0-9])`, "i")
    : null;

  return rows
    .filter((row) => {
      const deptCode = String(row.departmentId?.code || "").trim().toUpperCase();
      const semNumber = Number(row.semesterId?.number || 0);
      if (deptCode !== course || semNumber !== semester) return false;
      if (!sectionPattern) return true;
      return sectionPattern.test(String(row.name || ""));
    })
    .map((row) => row._id);
};

const resolveStudentClassSectionIds = async (studentId) => {
  const enrollments = await Enrollment.find({ studentId, status: "active" }).select("classSectionId");
  const activeIds = enrollments.map((row) => row.classSectionId);
  if (activeIds.length > 0) return activeIds;
  return inferClassSectionIdsForStudent(studentId);
};

const isStudentCourseSemesterMatch = (student, subjectDetails) => {
  const studentCourse = normalizeCourse(student?.course);
  const subjectCourse = normalizeCourse(subjectDetails?.course);
  const studentSemester = Number(student?.semester || 0);
  const subjectSemester = Number(subjectDetails?.semester || 0);
  return Boolean(
    studentCourse &&
      subjectCourse &&
      studentSemester > 0 &&
      subjectSemester > 0 &&
      studentCourse === subjectCourse &&
      studentSemester === subjectSemester
  );
};

const resolveSubjectForActor = async ({ teacherId, subjectId, subject }) => {
  if (!teacherId) {
    return { ok: false, status: 400, message: "teacherId is required." };
  }

  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    return { ok: false, status: 400, message: "Invalid teacher id." };
  }

  const actor = await User.findById(teacherId).select("_id role");
  if (!actor) {
    return { ok: false, status: 401, message: "Login session expired. Please login again." };
  }

  let resolvedSubject = null;

  if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
    resolvedSubject = await Subject.findById(subjectId).select("_id name facultyId course semester");
  } else if (subject && mongoose.Types.ObjectId.isValid(String(subject))) {
    resolvedSubject = await Subject.findById(String(subject)).select(
      "_id name facultyId course semester"
    );
  } else if (subject) {
    const filter = { name: String(subject).trim() };
    if (actor.role === "faculty") filter.facultyId = actor._id;
    resolvedSubject = await Subject.findOne(filter)
      .sort({ createdAt: -1 })
      .select("_id name facultyId course semester");
  }

  if (!resolvedSubject) {
    return { ok: false, status: 400, message: "Valid subjectId (or resolvable subject) is required." };
  }

  if (actor.role === "admin") return { ok: true, subject: resolvedSubject, actor };

  if (actor.role === "faculty" && String(resolvedSubject.facultyId) === String(actor._id)) {
    return { ok: true, subject: resolvedSubject, actor };
  }

  return {
    ok: false,
    status: 403,
    message: "Only admin or assigned faculty can mark attendance for this subject."
  };
};

const resolveTimetableSlot = async ({
  studentId,
  subjectId,
  subjectDetails,
  teacherId,
  actor,
  date,
  timetableId
}) => {
  if (timetableId) {
    if (!mongoose.Types.ObjectId.isValid(timetableId)) {
      return { ok: false, status: 400, message: "Invalid timetable id." };
    }

    const slot = await Timetable.findById(timetableId).select(
      "_id classSectionId subjectId facultyId dayOfWeek startTime endTime"
    );
    if (!slot) return { ok: false, status: 404, message: "Timetable slot not found." };

    const classSectionIds = await resolveStudentClassSectionIds(studentId);
    let hasAccess = classSectionIds.some(
      (classSectionId) => String(classSectionId) === String(slot.classSectionId)
    );
    if (!hasAccess) {
      const student = await User.findById(studentId).select("course semester");
      const courseSemesterMatched = isStudentCourseSemesterMatch(student, subjectDetails);
      hasAccess = courseSemesterMatched;
    }
    if (!hasAccess) {
      return { ok: false, status: 403, message: "Student is not enrolled in this class section." };
    }

    if (String(slot.subjectId) !== String(subjectId)) {
      return { ok: false, status: 400, message: "Timetable slot does not match selected subject." };
    }
    if (actor.role === "faculty" && String(slot.facultyId) !== String(teacherId)) {
      return { ok: false, status: 403, message: "Faculty can mark only their own timetable period." };
    }

    return { ok: true, slot };
  }

  const classSectionIds = await resolveStudentClassSectionIds(studentId);
  if (classSectionIds.length === 0) {
    const student = await User.findById(studentId).select("course semester");
    const courseSemesterMatched = isStudentCourseSemesterMatch(student, subjectDetails);
    if (!courseSemesterMatched) {
      return { ok: false, status: 400, message: "Student is not enrolled in any class section." };
    }

    const fallbackFilter = {
      subjectId,
      dayOfWeek: dayLabel(date)
    };
    if (actor.role === "faculty") fallbackFilter.facultyId = teacherId;

    const fallbackSlots = await Timetable.find(fallbackFilter)
      .select("_id classSectionId subjectId facultyId dayOfWeek startTime endTime")
      .sort({ startTime: 1 });

    if (fallbackSlots.length > 0) {
      return { ok: true, slot: fallbackSlots[0] };
    }

    if (actor.role === "admin") {
      const anySlot = await Timetable.findOne({ subjectId })
        .select("_id classSectionId subjectId facultyId dayOfWeek startTime endTime")
        .sort({ dayOfWeek: 1, startTime: 1 });
      if (anySlot) return { ok: true, slot: anySlot };
    }

    return {
      ok: false,
      status: 400,
      message: "No timetable period found for this student, subject and date."
    };
  }

  const filter = {
    classSectionId: { $in: classSectionIds },
    subjectId,
    dayOfWeek: dayLabel(date)
  };
  if (actor.role === "faculty") filter.facultyId = teacherId;

  const slots = await Timetable.find(filter)
    .select("_id classSectionId subjectId facultyId dayOfWeek startTime endTime")
    .sort({ startTime: 1 });

  if (slots.length === 0) {
    if (actor.role === "admin") {
      const fallbackSlot = await Timetable.findOne({
        classSectionId: { $in: classSectionIds },
        subjectId
      })
        .select("_id classSectionId subjectId facultyId dayOfWeek startTime endTime")
        .sort({ dayOfWeek: 1, startTime: 1 });

      if (fallbackSlot) {
        return { ok: true, slot: fallbackSlot };
      }
    }

    return {
      ok: false,
      status: 400,
      message: "No timetable period found for this student, subject and date."
    };
  }

  return { ok: true, slot: slots[0] };
};

const saveAttendanceForPeriod = async ({ studentId, subject, status, teacherId, date, slot }) => {
  const markedDate = date || new Date();
  const dateKey = todayDateKey(markedDate);
  const attendance = await Attendance.findOneAndUpdate(
    {
      studentId,
      timetableId: slot._id,
      dateKey
    },
    {
      studentId,
      subjectId: subject._id,
      timetableId: slot._id,
      classSectionId: slot.classSectionId,
      dateKey,
      subject: subject.name,
      status,
      teacherId,
      date: markedDate
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return attendance;
};

router.post("/", async (req, res) => {
  try {
    const { studentId, subjectId, subject, status, teacherId, date, timetableId } = req.body;

    if (!studentId || !status || !teacherId) {
      return res.status(400).json({ message: "Student, status and teacherId are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid student id." });
    }

    if (!["present", "absent"].includes(status)) {
      return res.status(400).json({ message: "Status must be present or absent." });
    }

    const auth = await resolveSubjectForActor({ teacherId, subjectId, subject });
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const markedDate = date ? new Date(date) : new Date();
    const timetable = await resolveTimetableSlot({
      studentId,
      teacherId,
      actor: auth.actor,
      subjectId: auth.subject._id,
      subjectDetails: auth.subject,
      date: markedDate,
      timetableId
    });
    if (!timetable.ok) {
      return res.status(timetable.status).json({ message: timetable.message });
    }

    const attendance = await saveAttendanceForPeriod({
      studentId,
      subject: auth.subject,
      status,
      teacherId,
      date: markedDate,
      slot: timetable.slot
    });

    res.status(200).json({ message: "Attendance saved for this timetable period", attendance });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Attendance already exists for this timetable period." });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "records must be a non-empty array." });
    }

    const normalized = [];

    for (const row of records) {
      const { studentId, subjectId, subject, status, teacherId, date, timetableId } = row || {};

      if (!studentId || !status || !teacherId) {
        return res.status(400).json({ message: "Each record needs studentId, status and teacherId." });
      }

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student id in records." });
      }

      if (!["present", "absent"].includes(status)) {
        return res.status(400).json({ message: "Status must be present or absent." });
      }

      const auth = await resolveSubjectForActor({ teacherId, subjectId, subject });
      if (!auth.ok) {
        return res.status(auth.status).json({ message: auth.message });
      }
      const markedDate = date ? new Date(date) : new Date();
      const timetable = await resolveTimetableSlot({
        studentId,
        teacherId,
        actor: auth.actor,
        subjectId: auth.subject._id,
        subjectDetails: auth.subject,
        date: markedDate,
        timetableId
      });
      if (!timetable.ok) {
        return res.status(timetable.status).json({ message: timetable.message });
      }

      normalized.push({
        studentId,
        subject: auth.subject,
        status,
        teacherId,
        date: markedDate,
        slot: timetable.slot
      });
    }

    const saved = [];
    for (const row of normalized) {
      saved.push(await saveAttendanceForPeriod(row));
    }

    res.status(200).json({ message: "Bulk attendance saved", count: saved.length });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Attendance already exists for this timetable period." });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { studentId } = req.query;
    const filter = {};

    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student id." });
      }
      filter.studentId = studentId;
    }

    const data = await Attendance.find(filter).sort({ date: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid student id." });
    }

    const data = await Attendance.find({ studentId }).sort({ date: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
