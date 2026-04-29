import express from "express";
import mongoose from "mongoose";
import FeeInvoice from "../models/FeeInvoice.js";
import SemesterFee from "../models/SemesterFee.js";
import User from "../models/User.js";

const router = express.Router();

const buildInvoiceNumber = () => `INV-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const normalizeInvoiceStatus = (invoice) => {
  const amount = Number(invoice.amount || 0);
  const paidAmount = Number(invoice.paidAmount || 0);
  const isOverdue = invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now();

  if (paidAmount >= amount) return "paid";
  if (paidAmount > 0) return "partially_paid";
  if (isOverdue) return "overdue";
  return "pending";
};

router.post("/generate", async (req, res) => {
  try {
    const { semesterFeeId, issueDate } = req.body;
    if (!semesterFeeId || !mongoose.Types.ObjectId.isValid(semesterFeeId)) {
      return res.status(400).json({ message: "Valid semesterFeeId is required." });
    }

    const semesterFee = await SemesterFee.findById(semesterFeeId);
    if (!semesterFee || !semesterFee.active) {
      return res.status(404).json({ message: "Active semester fee setup not found." });
    }

    const students = await User.find({
      role: "student",
      course: semesterFee.course,
      semester: Number(semesterFee.semester)
    }).select("_id");

    if (students.length === 0) {
      return res.status(400).json({ message: "No students found in this course and semester." });
    }

    const baseDate = issueDate ? new Date(issueDate) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      return res.status(400).json({ message: "Invalid issueDate." });
    }
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + Number(semesterFee.dueDaysAfterIssue || 0));

    const studentIds = students.map((s) => s._id);
    const existing = await FeeInvoice.find({
      semesterFeeId: semesterFee._id,
      studentId: { $in: studentIds }
    }).select("studentId");
    const existingSet = new Set(existing.map((x) => String(x.studentId)));

    const docs = studentIds
      .filter((id) => !existingSet.has(String(id)))
      .map((studentId) => ({
        studentId,
        semesterFeeId: semesterFee._id,
        title: semesterFee.title,
        invoiceNumber: buildInvoiceNumber(),
        course: semesterFee.course,
        semester: semesterFee.semester,
        amount: Number(semesterFee.amount),
        paidAmount: 0,
        dueDate,
        status: "pending"
      }));

    if (docs.length === 0) {
      return res.json({ message: "All invoices already generated.", created: 0, skipped: students.length });
    }

    const created = await FeeInvoice.insertMany(docs);
    return res.status(201).json({
      message: "Invoices generated successfully.",
      created: created.length,
      skipped: students.length - created.length
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};
    const { studentId, status, course, semester } = req.query;

    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid studentId." });
      }
      filter.studentId = studentId;
    }

    if (status) filter.status = status;
    if (course) filter.course = String(course).trim();
    if (semester !== undefined) {
      const sem = Number(semester);
      if (Number.isNaN(sem)) return res.status(400).json({ message: "Invalid semester." });
      filter.semester = sem;
    }

    const rows = await FeeInvoice.find(filter)
      .populate("studentId", "name email course semester rollNumber universityRollNumber")
      .populate("semesterFeeId", "title amount course semester dueDaysAfterIssue")
      .sort({ createdAt: -1 });

    const normalized = rows.map((row) => {
      const statusNow = normalizeInvoiceStatus(row);
      const balance = Math.max(0, Number(row.amount || 0) - Number(row.paidAmount || 0));
      return {
        ...row.toObject(),
        status: statusNow,
        balanceAmount: balance
      };
    });

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }

    const row = await FeeInvoice.findById(req.params.id)
      .populate("studentId", "name email course semester rollNumber universityRollNumber")
      .populate("semesterFeeId", "title amount course semester dueDaysAfterIssue");

    if (!row) return res.status(404).json({ message: "Not found." });
    const statusNow = normalizeInvoiceStatus(row);
    const balance = Math.max(0, Number(row.amount || 0) - Number(row.paidAmount || 0));
    res.json({ ...row.toObject(), status: statusNow, balanceAmount: balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.invoiceNumber) payload.invoiceNumber = buildInvoiceNumber();
    if (payload.paidAmount === undefined || payload.paidAmount === null) payload.paidAmount = 0;
    const created = await FeeInvoice.create(payload);
    const row = await FeeInvoice.findById(created._id)
      .populate("studentId", "name email course semester rollNumber universityRollNumber")
      .populate("semesterFeeId", "title amount course semester dueDaysAfterIssue");
    res.status(201).json(row);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate fee invoice entry." });
    }
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }

    const updated = await FeeInvoice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate("studentId", "name email course semester rollNumber universityRollNumber")
      .populate("semesterFeeId", "title amount course semester dueDaysAfterIssue");

    if (!updated) return res.status(404).json({ message: "Not found." });
    res.json(updated);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate fee invoice entry." });
    }
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }

    const deleted = await FeeInvoice.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found." });
    res.json({ message: "Deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
