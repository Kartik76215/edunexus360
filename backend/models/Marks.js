import mongoose from "mongoose";

const marksSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Marks", marksSchema);
