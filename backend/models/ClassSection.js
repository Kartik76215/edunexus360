import mongoose from "mongoose";

const classSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: "Semester", required: true },
    coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    capacity: { type: Number, default: 60 }
  },
  { timestamps: true }
);

classSectionSchema.index({ name: 1, departmentId: 1, semesterId: 1 }, { unique: true });

export default mongoose.model("ClassSection", classSectionSchema);
