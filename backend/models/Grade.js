import mongoose from "mongoose";

const gradeSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    remarks: { type: String, default: "" }
  },
  { timestamps: true }
);

gradeSchema.index({ examId: 1, studentId: 1 }, { unique: true });

export default mongoose.model("Grade", gradeSchema);
