import mongoose from "mongoose";

const attendanceSessionSchema = new mongoose.Schema(
  {
    timetableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Timetable",
      required: true
    },
    classSectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    sessionDateKey: {
      type: String,
      required: true
    },
    startAt: {
      type: Date,
      required: true
    },
    endAt: {
      type: Date,
      required: true
    },
    source: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

attendanceSessionSchema.index(
  { timetableId: 1, sessionDateKey: 1, source: 1 },
  { unique: true }
);

export default mongoose.model("AttendanceSession", attendanceSessionSchema);
