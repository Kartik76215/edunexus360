import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    noticeType: {
      type: String,
      enum: ["notice", "event", "workshop"],
      default: "notice"
    },
    eventDate: { type: Date },
    imageData: { type: String, default: "" },
    imageName: { type: String, default: "" },
    audience: { type: String, enum: ["all", "students", "faculty", "staff", "class"], default: "all" },
    classSectionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Notice", noticeSchema);
