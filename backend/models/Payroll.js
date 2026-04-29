import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidOn: { type: Date }
  },
  { timestamps: true }
);

payrollSchema.index({ facultyId: 1, month: 1 }, { unique: true });

export default mongoose.model("Payroll", payrollSchema);
