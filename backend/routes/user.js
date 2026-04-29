import express from "express";
import mongoose from "mongoose";
import ClassSection from "../models/ClassSection.js";
import Department from "../models/Department.js";
import Enrollment from "../models/Enrollment.js";
import Semester from "../models/Semester.js";
import User from "../models/User.js";
import { hashPassword, toSafeUser } from "../utils/security.js";

const router = express.Router();
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSection = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^SECTION\s+/, "")
    .replace(/^SEC\s+/, "")
    .replace(/[^A-Z0-9]/g, "");

const findClassSectionForStudent = async ({ course, semester, section }) => {
  const normalizedCourse = String(course || "").trim();
  const normalizedSection = normalizeSection(section);
  const semesterNumber = Number(semester || 0);

  if (!normalizedCourse || !normalizedSection || semesterNumber <= 0) return null;

  const [department, semesterDoc] = await Promise.all([
    Department.findOne({
      code: { $regex: `^${escapeRegex(normalizedCourse)}$`, $options: "i" }
    }).select("_id"),
    Semester.findOne({ number: semesterNumber }).sort({ createdAt: -1 }).select("_id")
  ]);

  if (!department || !semesterDoc) return null;

  return ClassSection.findOne({
    departmentId: department._id,
    semesterId: semesterDoc._id,
    name: {
      $regex: `^${escapeRegex(normalizedCourse)}\\s+Sem\\s+${semesterNumber}-${escapeRegex(normalizedSection)}$`,
      $options: "i"
    }
  }).select("_id");
};

const syncStudentEnrollment = async (student) => {
  if (!student || student.role !== "student") return;

  const classSection = await findClassSectionForStudent({
    course: student.course,
    semester: student.semester,
    section: student.section
  });

  if (!classSection) return;

  await Enrollment.updateMany(
    { studentId: student._id, classSectionId: { $ne: classSection._id }, status: "active" },
    { $set: { status: "inactive" } }
  );

  await Enrollment.findOneAndUpdate(
    { studentId: student._id, classSectionId: classSection._id },
    {
      $set: {
        status: "active",
        enrolledOn: new Date()
      }
    },
    { upsert: true, new: true, runValidators: true }
  );
};

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
      section = "",
      semester = 1,
      rollNumber = "",
      universityRollNumber = ""
    } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    const normalizedSection = normalizeSection(section);
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
      section: normalizedSection,
      semester: Number(semester) || 1,
      rollNumber: normalizedRoll,
      universityRollNumber: normalizedUniversityRoll
    });

    await user.save();
    await syncStudentEnrollment(user);

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

    const allowed = [
      "name",
      "role",
      "designation",
      "course",
      "section",
      "semester",
      "rollNumber",
      "universityRollNumber"
    ];
    const updates = {};

    for (const key of allowed) {
      if (key in req.body) {
        updates[key] = req.body[key];
      }
    }

    if (typeof updates.name === "string") updates.name = updates.name.trim();
    if (typeof updates.designation === "string") updates.designation = updates.designation.trim();
    if (typeof updates.course === "string") updates.course = updates.course.trim();
    if (typeof updates.section === "string") updates.section = normalizeSection(updates.section);
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

    await syncStudentEnrollment(updated);

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


