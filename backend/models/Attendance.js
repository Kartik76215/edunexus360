import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
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
    timetableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Timetable"
    },
    classSectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection"
    },
    dateKey: {
      type: String,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

attendanceSchema.index(
  { studentId: 1, timetableId: 1, dateKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      timetableId: { $exists: true },
      dateKey: { $exists: true, $type: "string" }
    }
  }
);

export default mongoose.model("Attendance", attendanceSchema);
