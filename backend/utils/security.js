import crypto from "crypto";

const KEY_LENGTH = 64;

const scryptAsync = (password, salt) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });

export const isHashedPassword = (value = "") =>
  typeof value === "string" && value.startsWith("scrypt$");

export const hashPassword = async (plainPassword) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scryptAsync(plainPassword, salt);
  return `scrypt$${salt}$${hash.toString("hex")}`;
};

export const verifyPassword = async (plainPassword, storedPassword) => {
  if (!isHashedPassword(storedPassword)) {
    return plainPassword === storedPassword;
  }

  const parts = storedPassword.split("$");
  if (parts.length !== 3) return false;

  const salt = parts[1];
  const storedHashHex = parts[2];
  const derivedHash = await scryptAsync(plainPassword, salt);

  return crypto.timingSafeEqual(
    Buffer.from(storedHashHex, "hex"),
    Buffer.from(derivedHash.toString("hex"), "hex")
  );
};

export const toSafeUser = (userDoc) => {
  if (!userDoc) return null;
  const plain = typeof userDoc.toObject === "function" ? userDoc.toObject() : userDoc;
  const { password, ...safeUser } = plain;
  return safeUser;
};
