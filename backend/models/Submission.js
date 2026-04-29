import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    attachmentUrl: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
    grade: { type: Number, min: 0, max: 100 },
    feedback: { type: String, default: "" }
  },
  { timestamps: true }
);

submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export default mongoose.model("Submission", submissionSchema);
