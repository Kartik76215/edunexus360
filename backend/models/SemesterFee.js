import mongoose from "mongoose";

const semesterFeeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Semester Fee"
    },
    course: {
      type: String,
      required: true,
      trim: true
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    dueDaysAfterIssue: {
      type: Number,
      default: 15,
      min: 0,
      max: 120
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

semesterFeeSchema.index(
  { course: 1, semester: 1, title: 1 },
  { unique: true }
);

export default mongoose.model("SemesterFee", semesterFeeSchema);
