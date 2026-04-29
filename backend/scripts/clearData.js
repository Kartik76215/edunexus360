import mongoose from "mongoose";

import AcademicYear from "../models/AcademicYear.js";
import AdmissionApplication from "../models/AdmissionApplication.js";
import Assignment from "../models/Assignment.js";
import Attendance from "../models/Attendance.js";
import AttendanceSession from "../models/AttendanceSession.js";
import ClassSection from "../models/ClassSection.js";
import Department from "../models/Department.js";
import Enrollment from "../models/Enrollment.js";
import Exam from "../models/Exam.js";
import FaceAttendanceLog from "../models/FaceAttendanceLog.js";
import FaceData from "../models/FaceData.js";
import FeeInvoice from "../models/FeeInvoice.js";
import Grade from "../models/Grade.js";
import Marks from "../models/Marks.js";
import Message from "../models/Message.js";
import Notice from "../models/Notice.js";
import Payment from "../models/Payment.js";
import Payroll from "../models/Payroll.js";
import Semester from "../models/Semester.js";
import SemesterFee from "../models/SemesterFee.js";
import Subject from "../models/Subject.js";
import Submission from "../models/Submission.js";
import Timetable from "../models/Timetable.js";
import User from "../models/User.js";

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/edunexus360";

const models = [
  Submission,
  Assignment,
  FaceAttendanceLog,
  AttendanceSession,
  FaceData,
  Timetable,
  Enrollment,
  Attendance,
  Marks,
  Grade,
  Exam,
  Payment,
  FeeInvoice,
  SemesterFee,
  Message,
  Notice,
  Payroll,
  AdmissionApplication,
  Subject,
  ClassSection,
  Semester,
  AcademicYear,
  Department,
  User
];

try {
  await mongoose.connect(mongoUri);

  for (const model of models) {
    await model.deleteMany({});
  }

  console.log("Cleared users, students, faculty, and all seeded application data.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
