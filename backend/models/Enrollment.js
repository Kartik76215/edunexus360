import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classSectionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
    status: { type: String, enum: ["active", "inactive", "graduated"], default: "active" },
    enrolledOn: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

enrollmentSchema.index({ studentId: 1, classSectionId: 1 }, { unique: true });

export default mongoose.model("Enrollment", enrollmentSchema);
