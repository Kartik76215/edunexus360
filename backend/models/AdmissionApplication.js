import mongoose from "mongoose";

const admissionApplicationSchema = new mongoose.Schema(
  {
    applicantName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    desiredDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    status: { type: String, enum: ["new", "reviewed", "accepted", "rejected"], default: "new" },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("AdmissionApplication", admissionApplicationSchema);
