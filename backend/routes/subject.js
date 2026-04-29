import express from "express";
import mongoose from "mongoose";
import Subject from "../models/Subject.js";
import User from "../models/User.js";

const router = express.Router();

// Add subject (must be assigned to a faculty)
router.post("/", async (req, res) => {
  try {
    const { course, semester, name, facultyId } = req.body;

    if (!course || !semester || !name || !facultyId) {
      return res.status(400).json({ message: "Course, semester, subject name and faculty are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(facultyId)) {
      return res.status(400).json({ message: "Invalid faculty id." });
    }

    const faculty = await User.findById(facultyId).select("_id role");
    if (!faculty || faculty.role !== "faculty") {
      return res.status(400).json({ message: "Assigned faculty not found." });
    }

    const normalized = {
      course: String(course).trim(),
      semester: Number(semester),
      name: String(name).trim(),
      facultyId
    };

    const exists = await Subject.findOne({
      course: normalized.course,
      semester: normalized.semester,
      name: normalized.name
    });

    if (exists) {
      return res.status(409).json({ message: "Subject already exists for this course/semester." });
    }

    const subject = new Subject(normalized);
    await subject.save();
    const populated = await Subject.findById(subject._id).populate("facultyId", "name email designation");

    res.status(201).json({ message: "Subject added", subject: populated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all subjects (optional filters: facultyId, course, semester)
router.get("/", async (req, res) => {
  try {
    const { facultyId, course, semester } = req.query;
    const filter = {};

    if (facultyId) {
      if (!mongoose.Types.ObjectId.isValid(facultyId)) {
        return res.status(400).json({ message: "Invalid faculty id." });
      }
      filter.facultyId = facultyId;
    }

    if (course) filter.course = String(course).trim();
    if (semester !== undefined) {
      const sem = Number(semester);
      if (Number.isNaN(sem)) {
        return res.status(400).json({ message: "Invalid semester." });
      }
      filter.semester = sem;
    }

    const subjects = await Subject.find(filter)
      .populate("facultyId", "name email designation")
      .sort({ course: 1, semester: 1, name: 1 });

    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subjects by course + semester
router.get("/:course/:sem", async (req, res) => {
  try {
    const course = String(req.params.course || "").trim();
    const semester = Number(req.params.sem);

    if (!course || Number.isNaN(semester)) {
      return res.status(400).json({ message: "Invalid course or semester." });
    }

    const subjects = await Subject.find({ course, semester })
      .populate("facultyId", "name email designation")
      .sort({ name: 1 });

    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single subject by id (compat/support)
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid subject id." });
    }

    const subject = await Subject.findById(req.params.id).populate(
      "facultyId",
      "name email designation"
    );

    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid subject id." });
    }

    const deleted = await Subject.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Subject not found." });
    }

    res.json({ message: "Subject deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
