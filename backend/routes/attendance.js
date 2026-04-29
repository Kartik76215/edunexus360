import express from "express";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";

const router = express.Router();

const resolveSubjectForActor = async ({ teacherId, subjectId, subject }) => {
  if (!teacherId) {
    return { ok: false, status: 400, message: "teacherId is required." };
  }

  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    return { ok: false, status: 400, message: "Invalid teacher id." };
  }

  const actor = await User.findById(teacherId).select("_id role");
  if (!actor) {
    return { ok: false, status: 404, message: "Teacher/admin user not found." };
  }

  let resolvedSubject = null;

  if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
    resolvedSubject = await Subject.findById(subjectId).select("_id name facultyId");
  } else if (subject && mongoose.Types.ObjectId.isValid(String(subject))) {
    resolvedSubject = await Subject.findById(String(subject)).select("_id name facultyId");
  } else if (subject) {
    const filter = { name: String(subject).trim() };
    if (actor.role === "faculty") filter.facultyId = actor._id;
    resolvedSubject = await Subject.findOne(filter).sort({ createdAt: -1 }).select("_id name facultyId");
  }

  if (!resolvedSubject) {
    return { ok: false, status: 400, message: "Valid subjectId (or resolvable subject) is required." };
  }

  if (actor.role === "admin") return { ok: true, subject: resolvedSubject };

  if (actor.role === "faculty" && String(resolvedSubject.facultyId) === String(actor._id)) {
    return { ok: true, subject: resolvedSubject };
  }

  return {
    ok: false,
    status: 403,
    message: "Only admin or assigned faculty can mark attendance for this subject."
  };
};

router.post("/", async (req, res) => {
  try {
    const { studentId, subjectId, subject, status, teacherId, date } = req.body;

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

    const attendance = new Attendance({
      studentId,
      subjectId: auth.subject._id,
      subject: auth.subject.name,
      status,
      teacherId,
      date: date ? new Date(date) : undefined
    });

    await attendance.save();
    res.status(201).json({ message: "Attendance marked", attendance });
  } catch (error) {
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
      const { studentId, subjectId, subject, status, teacherId, date } = row || {};

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

      normalized.push({
        studentId,
        subjectId: auth.subject._id,
        subject: auth.subject.name,
        status,
        teacherId,
        date: date ? new Date(date) : undefined
      });
    }

    const inserted = await Attendance.insertMany(normalized);
    res.status(201).json({ message: "Bulk attendance marked", count: inserted.length });
  } catch (error) {
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
