import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    classSectionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    examDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ["quiz", "midterm", "final", "assignment"], default: "quiz" }
  },
  { timestamps: true }
);

export default mongoose.model("Exam", examSchema);
