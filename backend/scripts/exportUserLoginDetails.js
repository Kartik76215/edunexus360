import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import User from "../models/User.js";

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/edunexus360";

const run = async () => {
  await mongoose.connect(mongoUri);

  const users = await User.find()
    .sort({ role: 1, course: 1, semester: 1, name: 1 })
    .select("name email role course semester rollNumber universityRollNumber");

  const lines = [
    "EduNexus360 User Login Details",
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    "",
    "Name\tEmail\tRole\tCourse\tSemester\tClass Roll\tUniversity Roll",
    ...users.map((user) =>
      [
        user.name,
        user.email,
        user.role,
        user.course || "",
        user.semester || "",
        user.rollNumber || "",
        user.universityRollNumber || ""
      ].join("\t")
    )
  ];

  const outputPath = path.resolve("..", "all_users_login_details.txt");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");

  console.log(`Exported ${users.length} users to ${outputPath}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Export failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
