import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    feeInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, default: Date.now },
    method: { type: String, enum: ["cash", "card", "upi", "bank"], default: "upi" },
    transactionRef: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
