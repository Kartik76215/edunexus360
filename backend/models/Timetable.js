import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema(
  {
    classSectionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dayOfWeek: { type: String, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Timetable", timetableSchema);
