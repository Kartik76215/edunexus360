import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ["admin", "faculty", "student"],
    default: "student"
  },

  designation: {
    type: String,
    default: ""
  },

  subjects: {
    type: [String],
    default: []
  },

  course: {
    type: String,
    default: ""
  },

  section: {
    type: String,
    default: "",
    trim: true,
    uppercase: true
  },

  rollNumber: {
    type: String,
    default: "",
    trim: true
  },

  universityRollNumber: {
    type: String,
    default: "",
    trim: true
  },

  semester: {
    type: Number,
    default: 1
  }

}, { timestamps: true });

userSchema.index(
  { course: 1, semester: 1, rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { rollNumber: { $type: "string", $ne: "" } }
  }
);

userSchema.index(
  { universityRollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { universityRollNumber: { $type: "string", $ne: "" } }
  }
);

export default mongoose.model("User", userSchema);
