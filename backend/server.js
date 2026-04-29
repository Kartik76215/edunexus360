import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import faceAttendanceRoutes from "./routes/faceAttendance.js";
import attendanceRoutes from "./routes/attendance.js";
import marksRoutes from "./routes/marks.js";
import subjectRoutes from "./routes/subject.js";
import departmentRoutes from "./routes/departments.js";
import academicYearRoutes from "./routes/academicYears.js";
import semesterRoutes from "./routes/semesters.js";
import classSectionRoutes from "./routes/classSections.js";
import enrollmentRoutes from "./routes/enrollments.js";
import timetableRoutes from "./routes/timetables.js";
import assignmentRoutes from "./routes/assignments.js";
import submissionRoutes from "./routes/submissions.js";
import examRoutes from "./routes/exams.js";
import gradeRoutes from "./routes/grades.js";
import semesterFeeRoutes from "./routes/semesterFees.js";
import feeInvoiceRoutes from "./routes/feeInvoices.js";
import paymentRoutes from "./routes/payments.js";
import payrollRoutes from "./routes/payrolls.js";
import noticeRoutes from "./routes/notices.js";
import messageRoutes from "./routes/messages.js";
import admissionRoutes from "./routes/admissions.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*"
  })
);
app.use(express.json({ limit: "8mb" }));

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", faceAttendanceRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/academic-years", academicYearRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/class-sections", classSectionRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/semester-fees", semesterFeeRoutes);
app.use("/api/fee-invoices", feeInvoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payrolls", payrollRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admissions", admissionRoutes);

app.get("/", (req, res) => {
  res.send("API is working");
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
