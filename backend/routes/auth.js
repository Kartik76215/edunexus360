import express from "express";
import User from "../models/User.js";
import { hashPassword, isHashedPassword, toSafeUser, verifyPassword } from "../utils/security.js";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "student" } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const user = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      password: await hashPassword(String(password)),
      role
    });
    await user.save();

    res.status(201).json({ message: "User registered successfully", user: toSafeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await verifyPassword(String(password), user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Upgrade legacy plain-text passwords to hashed on successful login.
    if (!isHashedPassword(user.password)) {
      user.password = await hashPassword(String(password));
      await user.save();
    }

    res.json({ message: "Login successful", user: toSafeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
