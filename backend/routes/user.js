import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { hashPassword, toSafeUser } from "../utils/security.js";

const router = express.Router();

// Add new user (Admin adds student/faculty)
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "student",
      designation = "",
      subjects = [],
      course = "",
      semester = 1,
      rollNumber = "",
      universityRollNumber = ""
    } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    const normalizedRoll = String(rollNumber || "").trim().toUpperCase();
    const normalizedUniversityRoll = String(universityRollNumber || "").trim().toUpperCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    if (role === "student" && (!normalizedRoll || !normalizedUniversityRoll)) {
      return res
        .status(400)
        .json({ message: "Class roll number and university roll number are required for students." });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists." });
    }

    if (normalizedRoll) {
      const sameClassRoll = await User.findOne({
        rollNumber: normalizedRoll,
        course: String(course),
        semester: Number(semester) || 1
      }).select("_id");
      if (sameClassRoll) {
        return res.status(409).json({ message: "Class roll number already exists in this course/semester." });
      }
    }

    if (normalizedUniversityRoll) {
      const existingUniversityRoll = await User.findOne({
        universityRollNumber: normalizedUniversityRoll
      }).select("_id");
      if (existingUniversityRoll) {
        return res.status(409).json({ message: "University roll number already exists." });
      }
    }

    const user = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      password: await hashPassword(String(password)),
      role,
      designation: String(designation),
      subjects: Array.isArray(subjects) ? subjects : [],
      course: String(course),
      semester: Number(semester) || 1,
      rollNumber: normalizedRoll,
      universityRollNumber: normalizedUniversityRoll
    });

    await user.save();

    res.status(201).json({ message: "User added", user: toSafeUser(user) });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.rollNumber) {
      return res.status(409).json({ message: "Class roll number already exists in this course/semester." });
    }
    if (error?.code === 11000 && error?.keyPattern?.universityRollNumber) {
      return res.status(409).json({ message: "University roll number already exists." });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get all users (safe fields only)
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const allowed = ["name", "role", "designation", "course", "semester", "rollNumber", "universityRollNumber"];
    const updates = {};

    for (const key of allowed) {
      if (key in req.body) {
        updates[key] = req.body[key];
      }
    }

    if (typeof updates.name === "string") updates.name = updates.name.trim();
    if (typeof updates.designation === "string") updates.designation = updates.designation.trim();
    if (typeof updates.course === "string") updates.course = updates.course.trim();
    if (typeof updates.rollNumber === "string") updates.rollNumber = updates.rollNumber.trim().toUpperCase();
    if (typeof updates.universityRollNumber === "string") {
      updates.universityRollNumber = updates.universityRollNumber.trim().toUpperCase();
    }
    if (updates.semester !== undefined) updates.semester = Number(updates.semester) || 1;

    const currentUser = await User.findById(req.params.id).select("role rollNumber universityRollNumber course semester");
    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const finalRole = updates.role ?? currentUser.role;
    const finalRoll = updates.rollNumber ?? currentUser.rollNumber;
    const finalUniversityRoll = updates.universityRollNumber ?? currentUser.universityRollNumber;
    const finalCourse = updates.course ?? currentUser.course;
    const finalSemester = updates.semester ?? currentUser.semester;

    if (finalRole === "student" && (!String(finalRoll || "").trim() || !String(finalUniversityRoll || "").trim())) {
      return res.status(400).json({
        message: "Class roll number and university roll number are required for students."
      });
    }

    if (finalRoll) {
      const existingRoll = await User.findOne({
        rollNumber: String(finalRoll).trim().toUpperCase(),
        course: String(finalCourse),
        semester: Number(finalSemester) || 1,
        _id: { $ne: req.params.id }
      }).select("_id");
      if (existingRoll) {
        return res.status(409).json({ message: "Class roll number already exists in this course/semester." });
      }
    }

    if (finalUniversityRoll) {
      const existingUniversityRoll = await User.findOne({
        universityRollNumber: String(finalUniversityRoll).trim().toUpperCase(),
        _id: { $ne: req.params.id }
      }).select("_id");
      if (existingUniversityRoll) {
        return res.status(409).json({ message: "University roll number already exists." });
      }
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).select("-password");

    if (!updated) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User updated successfully", user: updated });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.rollNumber) {
      return res.status(409).json({ message: "Class roll number already exists in this course/semester." });
    }
    if (error?.code === 11000 && error?.keyPattern?.universityRollNumber) {
      return res.status(409).json({ message: "University roll number already exists." });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
