import mongoose from "mongoose";

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: Number, required: true, min: 1 },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  { timestamps: true }
);

semesterSchema.index({ number: 1, academicYearId: 1 }, { unique: true });

export default mongoose.model("Semester", semesterSchema);
