import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classSectionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    dueDate: { type: Date, required: true },
    attachmentUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Assignment", assignmentSchema);
