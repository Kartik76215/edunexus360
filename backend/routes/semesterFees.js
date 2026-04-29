import express from "express";
import mongoose from "mongoose";
import SemesterFee from "../models/SemesterFee.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filter = {};
    const { course, semester, active } = req.query;
    if (course) filter.course = String(course).trim();
    if (semester !== undefined) {
      const sem = Number(semester);
      if (Number.isNaN(sem)) return res.status(400).json({ message: "Invalid semester." });
      filter.semester = sem;
    }
    if (active !== undefined) filter.active = String(active) === "true";
    const rows = await SemesterFee.find(filter).sort({ createdAt: -1 });
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
    const row = await SemesterFee.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found." });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      course: String(req.body.course || "").trim(),
      title: String(req.body.title || "Semester Fee").trim(),
      semester: Number(req.body.semester),
      amount: Number(req.body.amount),
      dueDaysAfterIssue: Number(req.body.dueDaysAfterIssue || 15)
    };

    if (!payload.course || Number.isNaN(payload.semester) || Number.isNaN(payload.amount)) {
      return res.status(400).json({ message: "course, semester and amount are required." });
    }

    const created = await SemesterFee.create(payload);
    res.status(201).json(created);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Semester fee already exists for this course, semester and title." });
    }
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const payload = { ...req.body };
    if (payload.course !== undefined) payload.course = String(payload.course).trim();
    if (payload.title !== undefined) payload.title = String(payload.title).trim();
    if (payload.semester !== undefined) payload.semester = Number(payload.semester);
    if (payload.amount !== undefined) payload.amount = Number(payload.amount);
    if (payload.dueDaysAfterIssue !== undefined) {
      payload.dueDaysAfterIssue = Number(payload.dueDaysAfterIssue);
    }

    const updated = await SemesterFee.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ message: "Not found." });
    res.json(updated);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Semester fee already exists for this course, semester and title." });
    }
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const deleted = await SemesterFee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found." });
    res.json({ message: "Deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
