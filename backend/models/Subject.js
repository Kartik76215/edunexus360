import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    course: {
      type: String,
      required: true,
      trim: true
    },
    semester: {
      type: Number,
      required: true,
      min: 1
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

subjectSchema.index({ course: 1, semester: 1, name: 1 }, { unique: true });

export default mongoose.model("Subject", subjectSchema);
