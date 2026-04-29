import express from "express";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import FeeInvoice from "../models/FeeInvoice.js";

const router = express.Router();

const resolveInvoiceStatus = (invoice, nextPaidAmount) => {
  const amount = Number(invoice.amount || 0);
  const paidAmount = Number(nextPaidAmount || 0);
  const isOverdue = invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now();
  if (paidAmount >= amount) return "paid";
  if (paidAmount > 0) return "partially_paid";
  if (isOverdue) return "overdue";
  return "pending";
};

router.post("/submit", async (req, res) => {
  try {
    const { feeInvoiceId, studentId, amount, method, transactionRef } = req.body;

    if (!feeInvoiceId || !studentId) {
      return res.status(400).json({ message: "feeInvoiceId and studentId are required." });
    }
    if (!mongoose.Types.ObjectId.isValid(feeInvoiceId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid fee invoice id or student id." });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero." });
    }

    const invoice = await FeeInvoice.findById(feeInvoiceId);
    if (!invoice) return res.status(404).json({ message: "Fee invoice not found." });
    if (String(invoice.studentId) !== String(studentId)) {
      return res.status(403).json({ message: "You can only pay your own fee invoices." });
    }

    const currentPaid = Number(invoice.paidAmount || 0);
    const remaining = Math.max(0, Number(invoice.amount || 0) - currentPaid);
    if (remaining <= 0) {
      return res.status(400).json({ message: "This invoice is already fully paid." });
    }
    if (numericAmount > remaining) {
      return res.status(400).json({ message: `Payment exceeds remaining balance (${remaining}).` });
    }

    const payment = await Payment.create({
      feeInvoiceId: invoice._id,
      studentId,
      amount: numericAmount,
      method: method || "upi",
      transactionRef: String(transactionRef || "").trim()
    });

    const nextPaidAmount = currentPaid + numericAmount;
    invoice.paidAmount = nextPaidAmount;
    invoice.status = resolveInvoiceStatus(invoice, nextPaidAmount);
    await invoice.save();

    const populated = await Payment.findById(payment._id).populate("feeInvoiceId studentId");
    res.status(201).json({
      message: "Payment submitted successfully.",
      payment: populated,
      invoice: {
        _id: invoice._id,
        status: invoice.status,
        paidAmount: invoice.paidAmount,
        balanceAmount: Math.max(0, Number(invoice.amount || 0) - Number(invoice.paidAmount || 0))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};
    const { studentId, feeInvoiceId } = req.query;
    if (studentId) filter.studentId = studentId;
    if (feeInvoiceId) filter.feeInvoiceId = feeInvoiceId;
    const rows = await Payment.find(filter).populate("feeInvoiceId studentId").sort({ createdAt: -1 });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const row = await Payment.findById(req.params.id).populate("feeInvoiceId studentId");
    if (!row) return res.status(404).json({ message: "Not found." });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await Payment.create(req.body);
    const row = await Payment.findById(created._id).populate("feeInvoiceId studentId");
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const updated = await Payment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate("feeInvoiceId studentId");
    if (!updated) return res.status(404).json({ message: "Not found." });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const deleted = await Payment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found." });
    res.json({ message: "Deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
