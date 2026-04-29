import mongoose from "mongoose";

const faceAttendanceLogSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    timetableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Timetable",
      required: true
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendanceSession",
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
    dateKey: {
      type: String,
      required: true
    },
    markedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      enum: ["present"],
      default: "present"
    },
    matchDistance: {
      type: Number,
      required: true
    },
    matchScore: {
      type: Number,
      required: true
    },
    livenessBlinkCount: {
      type: Number,
      required: true
    },
    livenessHeadTurnAngle: {
      type: Number,
      required: true
    },
    ipAddress: {
      type: String,
      default: ""
    },
    location: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  { timestamps: true }
);

faceAttendanceLogSchema.index(
  { studentId: 1, timetableId: 1, dateKey: 1 },
  { unique: true }
);

export default mongoose.model("FaceAttendanceLog", faceAttendanceLogSchema);
