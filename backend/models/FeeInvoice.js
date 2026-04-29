import mongoose from "mongoose";

const feeInvoiceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    semesterFeeId: { type: mongoose.Schema.Types.ObjectId, ref: "SemesterFee" },
    title: { type: String, required: true },
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    course: { type: String, default: "", trim: true },
    semester: { type: Number, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "partially_paid", "paid", "overdue"],
      default: "pending"
    }
  },
  { timestamps: true }
);

feeInvoiceSchema.index({ studentId: 1, semesterFeeId: 1 }, { unique: true, sparse: true });

export default mongoose.model("FeeInvoice", feeInvoiceSchema);
