import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import FeeInvoice from "../models/FeeInvoice.js";
import Attendance from "../models/Attendance.js";

const router = express.Router();

const ensureSender = async (fromUserId) => {
  if (!fromUserId || !mongoose.Types.ObjectId.isValid(fromUserId)) {
    return { ok: false, status: 400, message: "Valid fromUserId is required." };
  }
  const sender = await User.findById(fromUserId).select("_id role name");
  if (!sender) return { ok: false, status: 404, message: "Sender not found." };
  if (!["admin", "faculty"].includes(sender.role)) {
    return { ok: false, status: 403, message: "Only admin/faculty can trigger mail merge." };
  }
  return { ok: true, sender };
};

const sendFeeMailMerge = async (req, res) => {
  try {
    const { fromUserId, course, semester, template } = req.body;
    const senderCheck = await ensureSender(fromUserId);
    if (!senderCheck.ok) {
      return res.status(senderCheck.status).json({ message: senderCheck.message });
    }

    const studentFilter = { role: "student" };
    if (course) studentFilter.course = String(course).trim();
    if (semester !== undefined && semester !== null && semester !== "") {
      const sem = Number(semester);
      if (Number.isNaN(sem)) return res.status(400).json({ message: "Invalid semester." });
      studentFilter.semester = sem;
    }

    const students = await User.find(studentFilter).select(
      "_id name email course semester section rollNumber universityRollNumber"
    );
    if (students.length === 0) {
      return res.status(400).json({ message: "No students found for selected filters." });
    }

    const studentIds = students.map((s) => s._id);
    const invoices = await FeeInvoice.find({
      studentId: { $in: studentIds },
      status: { $ne: "paid" }
    }).select("studentId amount paidAmount dueDate");

    const byStudent = new Map();
    for (const invoice of invoices) {
      const row = byStudent.get(String(invoice.studentId)) || [];
      row.push(invoice);
      byStudent.set(String(invoice.studentId), row);
    }

    const messages = [];
    const recipients = [];
    for (const student of students) {
      const dueRows = byStudent.get(String(student._id)) || [];
      const totalDue = dueRows.reduce(
        (sum, d) => sum + Math.max(0, Number(d.amount || 0) - Number(d.paidAmount || 0)),
        0
      );
      if (totalDue <= 0) continue;

      const nextDue = dueRows
        .map((d) => new Date(d.dueDate))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const dueDateText = nextDue ? nextDue.toLocaleDateString("en-IN") : "soon";
      recipients.push({
        studentId: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber || "",
        universityRollNumber: student.universityRollNumber || "",
        course: student.course || "",
        semester: student.semester || "",
        section: student.section || "",
        dueAmount: Number(totalDue.toFixed(2)),
        dueDate: dueDateText
      });

      const defaultText =
        `Dear ${student.name}, your pending fee is Rs ${totalDue.toFixed(2)}. ` +
        `Please submit before ${dueDateText}.`;
      const content = String(template || defaultText)
        .replaceAll("{name}", student.name)
        .replaceAll("{course}", student.course || "")
        .replaceAll("{semester}", String(student.semester || ""))
        .replaceAll("{section}", student.section || "")
        .replaceAll("{rollNumber}", student.rollNumber || "")
        .replaceAll("{dueAmount}", totalDue.toFixed(2))
        .replaceAll("{dueDate}", dueDateText);

      messages.push({
        fromUserId,
        toUserId: student._id,
        content,
        isBroadcast: false
      });
    }

    if (messages.length === 0) {
      return res.json({ message: "No students with pending fees found.", sent: 0, recipients: [] });
    }

    await Message.insertMany(messages);
    return res.status(201).json({
      message: "Fee reminders sent.",
      sent: messages.length,
      recipients
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const sendAttendanceMailMerge = async (req, res) => {
  try {
    const { fromUserId, threshold = 75, course, semester, template } = req.body;
    const senderCheck = await ensureSender(fromUserId);
    if (!senderCheck.ok) {
      return res.status(senderCheck.status).json({ message: senderCheck.message });
    }

    const thresholdNumber = Number(threshold);
    if (Number.isNaN(thresholdNumber) || thresholdNumber <= 0 || thresholdNumber > 100) {
      return res.status(400).json({ message: "threshold must be between 1 and 100." });
    }

    const studentFilter = { role: "student" };
    if (course) studentFilter.course = String(course).trim();
    if (semester !== undefined && semester !== null && semester !== "") {
      const sem = Number(semester);
      if (Number.isNaN(sem)) return res.status(400).json({ message: "Invalid semester." });
      studentFilter.semester = sem;
    }

    const students = await User.find(studentFilter).select(
      "_id name email course semester section rollNumber universityRollNumber"
    );
    if (students.length === 0) {
      return res.status(400).json({ message: "No students found for selected filters." });
    }

    const studentIds = students.map((s) => s._id);
    const logs = await Attendance.find({ studentId: { $in: studentIds } }).select("studentId status");

    const agg = new Map();
    for (const row of logs) {
      const key = String(row.studentId);
      if (!agg.has(key)) agg.set(key, { total: 0, present: 0 });
      const next = agg.get(key);
      next.total += 1;
      if (row.status === "present") next.present += 1;
    }

    const messages = [];
    const recipients = [];
    for (const student of students) {
      const stats = agg.get(String(student._id));
      if (!stats || stats.total === 0) continue;
      const pct = (stats.present / stats.total) * 100;
      if (pct >= thresholdNumber) continue;
      recipients.push({
        studentId: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber || "",
        universityRollNumber: student.universityRollNumber || "",
        course: student.course || "",
        semester: student.semester || "",
        section: student.section || "",
        attendance: Number(pct.toFixed(1)),
        threshold: thresholdNumber,
        present: stats.present,
        total: stats.total
      });

      const defaultText =
        `Dear ${student.name}, your attendance is ${pct.toFixed(1)}%. ` +
        `Minimum required is ${thresholdNumber}%. Please improve attendance immediately.`;
      const content = String(template || defaultText)
        .replaceAll("{name}", student.name)
        .replaceAll("{course}", student.course || "")
        .replaceAll("{semester}", String(student.semester || ""))
        .replaceAll("{section}", student.section || "")
        .replaceAll("{rollNumber}", student.rollNumber || "")
        .replaceAll("{attendance}", pct.toFixed(1))
        .replaceAll("{threshold}", String(thresholdNumber));

      messages.push({
        fromUserId,
        toUserId: student._id,
        content,
        isBroadcast: false
      });
    }

    if (messages.length === 0) {
      return res.json({
        message: "No students below attendance threshold.",
        sent: 0,
        recipients: []
      });
    }

    await Message.insertMany(messages);
    return res.status(201).json({
      message: "Attendance alerts sent.",
      sent: messages.length,
      recipients
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

router.post("/mail-merge/fees", sendFeeMailMerge);
router.post("/mailmerge/fees", sendFeeMailMerge);
router.post("/mail-merge/attendance", sendAttendanceMailMerge);
router.post("/mailmerge/attendance", sendAttendanceMailMerge);

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.fromUserId) filter.fromUserId = req.query.fromUserId;
    if (req.query.toUserId) filter.toUserId = req.query.toUserId;
    if (req.query.classSectionId) filter.classSectionId = req.query.classSectionId;

    const rows = await Message.find(filter)
      .populate("fromUserId toUserId classSectionId")
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const row = await Message.findById(req.params.id).populate("fromUserId toUserId classSectionId");
    if (!row) return res.status(404).json({ message: "Not found." });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await Message.create(req.body);
    const row = await Message.findById(created._id).populate("fromUserId toUserId classSectionId");
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const updated = await Message.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate("fromUserId toUserId classSectionId");
    if (!updated) return res.status(404).json({ message: "Not found." });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const deleted = await Message.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found." });
    res.json({ message: "Deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
