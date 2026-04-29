import express from "express";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import AttendanceSession from "../models/AttendanceSession.js";
import Enrollment from "../models/Enrollment.js";
import FaceAttendanceLog from "../models/FaceAttendanceLog.js";
import FaceData from "../models/FaceData.js";
import Timetable from "../models/Timetable.js";
import User from "../models/User.js";
import {
  attendanceConfig,
  computeSlotWindow,
  dayLabel,
  meanEmbedding,
  normalizeEmbedding,
  sanitizeEmbedding,
  signChallenge,
  todayDateKey,
  validateAccessConstraints,
  validateLiveness,
  verifyFaceMatch
} from "../utils/faceAttendance.js";

const router = express.Router();

const toBool = (value) => String(value || "").toLowerCase() === "true";

const findActiveSession = async (timetableId, dateKey, now = new Date()) => {
  const session = await AttendanceSession.findOne({
    timetableId,
    sessionDateKey: dateKey
  }).sort({ createdAt: -1 });
  if (!session) return null;
  if (now >= session.startAt && now <= session.endAt) return session;
  return null;
};

const findUserTimetablesForToday = async ({ role, userId }) => {
  const today = dayLabel(new Date());
  const filter = { dayOfWeek: today };

  if (role === "student") {
    const enrollments = await Enrollment.find({ studentId: userId, status: "active" }).select(
      "classSectionId"
    );
    const classSectionIds = enrollments.map((row) => row.classSectionId);
    if (classSectionIds.length === 0) return [];
    filter.classSectionId = { $in: classSectionIds };
  } else if (role === "faculty") {
    filter.facultyId = userId;
  }

  return Timetable.find(filter)
    .populate("classSectionId", "name")
    .populate("subjectId", "name course semester")
    .populate("facultyId", "name email designation")
    .sort({ startTime: 1 });
};

const formatSlot = async ({ slot, role, userId, includeTodayList, includeChallenge }) => {
  const now = new Date();
  const window = computeSlotWindow(slot, now, attendanceConfig.DEFAULT_WINDOW_MINUTES);
  const dateKey = todayDateKey(now);

  const session = await AttendanceSession.findOne({
    timetableId: slot._id,
    sessionDateKey: dateKey
  }).sort({ createdAt: -1 });
  const sessionActive = Boolean(session && now >= session.startAt && now <= session.endAt);

  let attendanceStatus = null;
  if (role === "student") {
    const log = await FaceAttendanceLog.findOne({
      studentId: userId,
      timetableId: slot._id,
      dateKey
    }).select("_id markedAt");
    attendanceStatus = {
      alreadyMarked: Boolean(log),
      markedAt: log?.markedAt || null
    };
  }

  const visibleNow = includeTodayList ? true : window.isWithinWindow || sessionActive;
  if (!visibleNow) return null;

  return {
    id: slot._id,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room || "",
    classSection: slot.classSectionId,
    subject: slot.subjectId,
    faculty: slot.facultyId,
    classStartAt: window.classStartAt,
    classEndAt: window.classEndAt,
    windowEndAt: window.windowEndAt,
    isClassRunning: window.isClassRunning,
    isWithinWindow: window.isWithinWindow,
    canMarkBySession: sessionActive,
    session: session
      ? {
          id: session._id,
          startAt: session.startAt,
          endAt: session.endAt,
          source: session.source,
          isActive: sessionActive
        }
      : null,
    attendanceStatus,
    challengeToken:
      includeChallenge && (window.isWithinWindow || sessionActive) && role === "student"
        ? signChallenge({ userId, timetableId: slot._id, ttlSeconds: 180 })
        : null
  };
};

router.post("/face-enroll", async (req, res) => {
  try {
    const { userId, embeddings, updatedBy } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required." });
    }

    if (!Array.isArray(embeddings) || embeddings.length < 3 || embeddings.length > 5) {
      return res.status(400).json({ message: "Provide 3 to 5 embedding samples." });
    }

    const user = await User.findById(userId).select("_id role");
    if (!user || !["student", "faculty"].includes(user.role)) {
      return res.status(400).json({ message: "Enrollment allowed only for student/faculty." });
    }

    const vectors = embeddings.map((sample) => sanitizeEmbedding(sample));
    if (vectors.some((vector) => !vector)) {
      return res.status(400).json({ message: "Invalid embedding sample payload." });
    }

    const vectorLength = vectors[0].length;
    if (vectors.some((vector) => vector.length !== vectorLength)) {
      return res.status(400).json({ message: "All embedding samples must have same vector length." });
    }

    const normalizedVectors = vectors.map((vector) => normalizeEmbedding(vector));
    const meanVector = meanEmbedding(normalizedVectors);

    const saved = await FaceData.findOneAndUpdate(
      { userId },
      {
        userId,
        embeddings: normalizedVectors,
        meanEmbedding: meanVector,
        vectorLength,
        sampleCount: normalizedVectors.length,
        updatedBy: mongoose.Types.ObjectId.isValid(updatedBy) ? updatedBy : undefined
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(201).json({
      message: "Face enrollment saved.",
      faceData: {
        userId: saved.userId,
        sampleCount: saved.sampleCount,
        vectorLength: saved.vectorLength,
        updatedAt: saved.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/face-verify", async (req, res) => {
  try {
    const { userId, embedding } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required." });
    }
    const sanitized = sanitizeEmbedding(embedding);
    if (!sanitized) return res.status(400).json({ message: "Valid embedding is required." });

    const faceData = await FaceData.findOne({ userId });
    if (!faceData) {
      return res.status(404).json({ message: "Face profile not enrolled for this user." });
    }
    if (sanitized.length !== faceData.vectorLength) {
      return res.status(400).json({ message: "Embedding vector length mismatch." });
    }

    const match = await verifyFaceMatch(sanitized, faceData.embeddings);
    return res.json({
      matched: match.matched,
      matchDistance: match.distance,
      matchScore: match.score,
      threshold: attendanceConfig.FACE_DISTANCE_THRESHOLD
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/timetable/current", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const includeTodayList = toBool(req.query.today);
    const includeChallenge = toBool(req.query.includeChallenge) || role === "student";

    let resolvedRole = String(role || "").trim();
    if (!resolvedRole) resolvedRole = "student";

    if (resolvedRole !== "admin" && !mongoose.Types.ObjectId.isValid(String(userId || ""))) {
      return res.status(400).json({ message: "Valid userId is required." });
    }

    if (!["admin", "faculty", "student"].includes(resolvedRole)) {
      return res.status(400).json({ message: "role must be admin, faculty, or student." });
    }

    const slots = await findUserTimetablesForToday({ role: resolvedRole, userId });
    const data = [];
    for (const slot of slots) {
      // Sequentially enrich to include per-slot session and student attendance status.
      const item = await formatSlot({
        slot,
        role: resolvedRole,
        userId,
        includeTodayList,
        includeChallenge
      });
      if (item) data.push(item);
    }

    return res.json({ classes: data, count: data.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/attendance/session/start", async (req, res) => {
  try {
    const { facultyId, timetableId, windowMinutes = attendanceConfig.DEFAULT_WINDOW_MINUTES } = req.body;
    if (!mongoose.Types.ObjectId.isValid(timetableId) || !mongoose.Types.ObjectId.isValid(facultyId)) {
      return res.status(400).json({ message: "Valid timetableId and facultyId are required." });
    }

    const [slot, actor] = await Promise.all([
      Timetable.findById(timetableId).populate("subjectId", "name"),
      User.findById(facultyId).select("_id role")
    ]);
    if (!slot) return res.status(404).json({ message: "Timetable slot not found." });
    if (!actor || !["admin", "faculty"].includes(actor.role)) {
      return res.status(403).json({ message: "Only faculty/admin can start session." });
    }
    if (actor.role === "faculty" && String(slot.facultyId) !== String(actor._id)) {
      return res.status(403).json({ message: "Faculty can start only their own class session." });
    }

    if (slot.dayOfWeek !== dayLabel(new Date())) {
      return res.status(400).json({ message: "No class scheduled for this timetable today." });
    }

    const now = new Date();
    const window = computeSlotWindow(slot, now, Number(windowMinutes));
    if (!window.classStartAt || !window.classEndAt || !window.isClassRunning) {
      return res.status(400).json({ message: "Manual session can be started only during class hours." });
    }

    const endAtByWindow = new Date(now.getTime() + Number(windowMinutes) * 60 * 1000);
    const endAt =
      endAtByWindow.getTime() < window.classEndAt.getTime() ? endAtByWindow : window.classEndAt;

    const dateKey = todayDateKey(now);
    const session = await AttendanceSession.findOneAndUpdate(
      { timetableId: slot._id, sessionDateKey: dateKey, source: "manual" },
      {
        timetableId: slot._id,
        classSectionId: slot.classSectionId,
        subjectId: slot.subjectId,
        facultyId: slot.facultyId,
        sessionDateKey: dateKey,
        startAt: now,
        endAt,
        source: "manual",
        createdBy: actor._id
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(201).json({
      message: "Attendance session started.",
      session
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/attendance/live", async (req, res) => {
  try {
    const { timetableId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(String(timetableId || ""))) {
      return res.status(400).json({ message: "Valid timetableId is required." });
    }
    const dateKey = String(req.query.date || todayDateKey(new Date()));

    const slot = await Timetable.findById(timetableId).populate("subjectId", "name");
    if (!slot) return res.status(404).json({ message: "Timetable slot not found." });

    const [students, logs] = await Promise.all([
      Enrollment.find({ classSectionId: slot.classSectionId, status: "active" })
        .populate("studentId", "name email rollNumber universityRollNumber")
        .select("studentId"),
      FaceAttendanceLog.find({ timetableId: slot._id, dateKey })
    ]);

    const presentSet = new Map(logs.map((log) => [String(log.studentId), log]));
    const rows = students.map((row) => {
      const studentId = row.studentId?._id;
      const log = presentSet.get(String(studentId));
      return {
        studentId,
        name: row.studentId?.name || "Student",
        email: row.studentId?.email || "",
        rollNumber: row.studentId?.rollNumber || "",
        universityRollNumber: row.studentId?.universityRollNumber || "",
        status: log ? "present" : "absent",
        markedAt: log?.markedAt || null
      };
    });

    return res.json({
      timetableId,
      subject: slot.subjectId?.name || "",
      dateKey,
      presentCount: rows.filter((row) => row.status === "present").length,
      absentCount: rows.filter((row) => row.status === "absent").length,
      students: rows
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/attendance/logs", async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) filter.dateKey = String(req.query.date);
    if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.timetableId) filter.timetableId = req.query.timetableId;

    const logs = await FaceAttendanceLog.find(filter)
      .populate("studentId", "name email rollNumber")
      .populate("subjectId", "name")
      .populate("facultyId", "name")
      .populate("classSectionId", "name")
      .sort({ markedAt: -1 });

    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/attendance/status", async (req, res) => {
  try {
    const { studentId, timetableId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(String(studentId || ""))) {
      return res.status(400).json({ message: "Valid studentId is required." });
    }

    const dateKey = String(req.query.date || todayDateKey(new Date()));
    const faceData = await FaceData.findOne({ userId: studentId }).select("_id sampleCount");
    let slot = null;

    if (mongoose.Types.ObjectId.isValid(String(timetableId || ""))) {
      slot = await Timetable.findById(timetableId)
        .populate("subjectId", "name")
        .populate("facultyId", "name")
        .populate("classSectionId", "name");
    } else {
      const slots = await findUserTimetablesForToday({ role: "student", userId: studentId });
      slot = slots.find((candidate) => computeSlotWindow(candidate, new Date()).isWithinWindow) || null;
    }

    if (!slot) {
      return res.json({
        canMark: false,
        reason: "No current class available for attendance window.",
        alreadyMarked: false,
        faceEnrolled: Boolean(faceData)
      });
    }

    const enrollment = await Enrollment.findOne({
      studentId,
      classSectionId: slot.classSectionId,
      status: "active"
    }).select("_id");

    if (!enrollment) {
      return res.json({
        canMark: false,
        reason: "Student is not enrolled in this class section.",
        alreadyMarked: false,
        faceEnrolled: Boolean(faceData),
        timetableId: slot._id
      });
    }

    const now = new Date();
    const window = computeSlotWindow(slot, now, attendanceConfig.DEFAULT_WINDOW_MINUTES);
    const activeSession = await findActiveSession(slot._id, dateKey, now);
    const marked = await FaceAttendanceLog.findOne({
      studentId,
      timetableId: slot._id,
      dateKey
    }).select("_id markedAt");

    const allowedByTime = window.isWithinWindow || Boolean(activeSession);
    const canMark = allowedByTime && !marked && Boolean(faceData);
    return res.json({
      canMark,
      reason: canMark
        ? "Attendance allowed."
        : marked
          ? "Attendance already marked."
          : !faceData
            ? "Face enrollment not found."
            : !allowedByTime
              ? "Outside allowed attendance window and no active faculty session."
              : "Not eligible to mark.",
      alreadyMarked: Boolean(marked),
      markedAt: marked?.markedAt || null,
      faceEnrolled: Boolean(faceData),
      timetableId: slot._id,
      subject: slot.subjectId,
      faculty: slot.facultyId,
      classSection: slot.classSectionId,
      windowEndAt: window.windowEndAt,
      activeSession: activeSession
        ? {
            id: activeSession._id,
            startAt: activeSession.startAt,
            endAt: activeSession.endAt,
            source: activeSession.source
          }
        : null,
      challengeToken: signChallenge({ userId: studentId, timetableId: slot._id, ttlSeconds: 180 })
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/mark-attendance", async (req, res) => {
  try {
    const { studentId, timetableId, embedding, liveness, challengeToken, location } = req.body;

    if (!mongoose.Types.ObjectId.isValid(String(studentId || ""))) {
      return res.status(400).json({ message: "Valid studentId is required." });
    }
    if (!mongoose.Types.ObjectId.isValid(String(timetableId || ""))) {
      return res.status(400).json({ message: "Valid timetableId is required." });
    }

    const [student, slot, faceData] = await Promise.all([
      User.findById(studentId).select("_id role"),
      Timetable.findById(timetableId).populate("subjectId", "name"),
      FaceData.findOne({ userId: studentId })
    ]);

    if (!student || student.role !== "student") {
      return res.status(400).json({ message: "Attendance can be marked only for student users." });
    }
    if (!slot) return res.status(404).json({ message: "Timetable slot not found." });
    if (!faceData) return res.status(400).json({ message: "Face not enrolled for this student." });

    const enrollment = await Enrollment.findOne({
      studentId,
      classSectionId: slot.classSectionId,
      status: "active"
    }).select("_id");
    if (!enrollment) {
      return res.status(403).json({ message: "Student is not enrolled in this class section." });
    }

    if (slot.dayOfWeek !== dayLabel(new Date())) {
      return res.status(403).json({ message: "Attendance not allowed for this class today." });
    }

    const now = new Date();
    const window = computeSlotWindow(slot, now, attendanceConfig.DEFAULT_WINDOW_MINUTES);
    const dateKey = todayDateKey(now);
    const activeSession = await findActiveSession(timetableId, dateKey, now);
    if (!window.isWithinWindow && !activeSession) {
      return res.status(403).json({
        message: "Attendance is allowed only in first 10 minutes or during active faculty session."
      });
    }

    const existing = await FaceAttendanceLog.findOne({
      studentId,
      timetableId,
      dateKey
    }).select("_id");
    if (existing) {
      return res.status(409).json({ message: "Attendance already marked for this class today." });
    }

    const sanitizedEmbedding = sanitizeEmbedding(embedding);
    if (!sanitizedEmbedding) {
      return res.status(400).json({ message: "Valid embedding vector is required." });
    }
    if (sanitizedEmbedding.length !== faceData.vectorLength) {
      return res.status(400).json({ message: "Embedding length mismatch." });
    }

    const livenessCheck = validateLiveness(liveness, challengeToken, studentId, timetableId);
    if (!livenessCheck.ok) {
      return res.status(403).json({ message: livenessCheck.message });
    }

    const accessCheck = validateAccessConstraints({ req, location });
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ message: accessCheck.message });
    }

    const match = await verifyFaceMatch(sanitizedEmbedding, faceData.embeddings);
    if (!match.matched) {
      return res.status(403).json({
        message: "Face verification failed.",
        matchDistance: match.distance,
        threshold: attendanceConfig.FACE_DISTANCE_THRESHOLD
      });
    }

    const autoEndAt =
      activeSession?.endAt || window.windowEndAt || new Date(now.getTime() + 10 * 60 * 1000);
    const session = await AttendanceSession.findOneAndUpdate(
      activeSession
        ? { _id: activeSession._id }
        : { timetableId, sessionDateKey: dateKey, source: "auto" },
      {
        timetableId,
        classSectionId: slot.classSectionId,
        subjectId: slot.subjectId,
        facultyId: slot.facultyId,
        sessionDateKey: dateKey,
        startAt: activeSession?.startAt || window.classStartAt || now,
        endAt: autoEndAt,
        source: activeSession?.source || "auto",
        createdBy: activeSession?.createdBy || studentId
      },
      { upsert: true, new: true, runValidators: true }
    );

    const created = await FaceAttendanceLog.create({
      studentId,
      timetableId,
      sessionId: session._id,
      classSectionId: slot.classSectionId,
      subjectId: slot.subjectId,
      facultyId: slot.facultyId,
      dateKey,
      markedAt: now,
      status: "present",
      matchDistance: match.distance,
      matchScore: match.score,
      livenessBlinkCount: livenessCheck.blinkCount,
      livenessHeadTurnAngle: livenessCheck.headTurnAngle,
      ipAddress: accessCheck.ipAddress,
      location:
        location && !Number.isNaN(Number(location.lat)) && !Number.isNaN(Number(location.lng))
          ? { lat: Number(location.lat), lng: Number(location.lng) }
          : undefined
    });

    // Keep legacy attendance list in sync for existing reports and dashboards.
    await Attendance.create({
      studentId,
      subjectId: slot.subjectId?._id || slot.subjectId,
      subject: slot.subjectId?.name || "Unknown Subject",
      status: "present",
      teacherId: slot.facultyId,
      date: now
    });

    return res.status(201).json({
      message: "Attendance marked successfully.",
      attendance: created,
      verification: {
        matchScore: match.score,
        matchDistance: match.distance
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Attendance already marked for this class today." });
    }
    return res.status(500).json({ error: error.message });
  }
});

export default router;
