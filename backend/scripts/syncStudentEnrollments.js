import mongoose from "mongoose";
import ClassSection from "../models/ClassSection.js";
import Department from "../models/Department.js";
import Enrollment from "../models/Enrollment.js";
import Semester from "../models/Semester.js";
import User from "../models/User.js";

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/edunexus360";

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSection = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^SECTION\s+/, "")
    .replace(/^SEC\s+/, "")
    .replace(/[^A-Z0-9]/g, "");

const findClassSection = async (student) => {
  const course = String(student.course || "").trim();
  const semester = Number(student.semester || 0);
  const section = normalizeSection(student.section);

  if (!course || semester <= 0 || !section) return null;

  const [department, semesterDoc] = await Promise.all([
    Department.findOne({ code: { $regex: `^${escapeRegex(course)}$`, $options: "i" } }).select("_id"),
    Semester.findOne({ number: semester }).sort({ createdAt: -1 }).select("_id")
  ]);

  if (!department || !semesterDoc) return null;

  return ClassSection.findOne({
    departmentId: department._id,
    semesterId: semesterDoc._id,
    name: {
      $regex: `^${escapeRegex(course)}\\s+Sem\\s+${semester}-${escapeRegex(section)}$`,
      $options: "i"
    }
  }).select("_id name");
};

const run = async () => {
  await mongoose.connect(mongoUri);

  const students = await User.find({ role: "student" }).select(
    "_id name email course semester section rollNumber"
  );
  const synced = [];
  const skipped = [];

  for (const student of students) {
    const classSection = await findClassSection(student);
    if (!classSection) {
      skipped.push({
        name: student.name,
        email: student.email,
        reason: "No matching class section"
      });
      continue;
    }

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

    synced.push({
      name: student.name,
      email: student.email,
      classSection: classSection.name
    });
  }

  console.log(`Synced enrollments: ${synced.length}`);
  console.log(`Skipped students: ${skipped.length}`);
  if (skipped.length > 0) console.table(skipped.slice(0, 10));

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Enrollment sync failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
