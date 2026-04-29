import mongoose from "mongoose";

const faceDataSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    embeddings: {
      type: [[Number]],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 3 && value.length <= 10,
        message: "Embeddings must contain 3 to 10 samples."
      }
    },
    meanEmbedding: {
      type: [Number],
      required: true
    },
    vectorLength: {
      type: Number,
      required: true
    },
    sampleCount: {
      type: Number,
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

export default mongoose.model("FaceData", faceDataSchema);
