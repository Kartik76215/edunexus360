import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    classSectionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    content: { type: String, required: true },
    isBroadcast: { type: Boolean, default: false },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
