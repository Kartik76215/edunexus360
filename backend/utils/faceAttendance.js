import crypto from "crypto";

const CHALLENGE_SECRET = process.env.FACE_CHALLENGE_SECRET || crypto.randomBytes(32).toString("hex");
const FACE_DISTANCE_THRESHOLD = Number(process.env.FACE_DISTANCE_THRESHOLD || 0.62);
const DEFAULT_WINDOW_MINUTES = Number(process.env.ATTENDANCE_WINDOW_MINUTES || 10);
const FACE_ENGINE = String(process.env.FACE_ENGINE || "node").toLowerCase();
const PYTHON_FACE_ENGINE_URL = process.env.PYTHON_FACE_ENGINE_URL || "http://127.0.0.1:8001";

export const sanitizeEmbedding = (embedding) => {
  if (!Array.isArray(embedding)) return null;
  const vector = embedding.map((value) => Number(value));
  if (vector.some((value) => Number.isNaN(value))) return null;
  if (vector.length < 64 || vector.length > 1024) return null;
  return vector;
};

const l2Norm = (vector) => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

export const normalizeEmbedding = (vector) => {
  const norm = l2Norm(vector);
  if (!norm) return vector.map(() => 0);
  return vector.map((value) => value / norm);
};

export const meanEmbedding = (vectors) => {
  if (!Array.isArray(vectors) || vectors.length === 0) return [];
  const length = vectors[0].length;
  const mean = Array.from({ length }, () => 0);
  for (const vector of vectors) {
    for (let i = 0; i < length; i += 1) mean[i] += vector[i];
  }
  return normalizeEmbedding(mean.map((sum) => sum / vectors.length));
};

export const euclideanDistance = (a, b) => {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

export const evaluateMatch = (inputEmbedding, storedEmbeddings) => {
  const normalizedInput = normalizeEmbedding(inputEmbedding);
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const sample of storedEmbeddings) {
    const distance = euclideanDistance(normalizedInput, sample);
    if (distance < bestDistance) bestDistance = distance;
  }
  const matched = bestDistance <= FACE_DISTANCE_THRESHOLD;
  const score = Number(Math.max(0, 1 - bestDistance).toFixed(4));
  return { matched, distance: Number(bestDistance.toFixed(6)), score };
};

export const verifyFaceMatch = async (inputEmbedding, storedEmbeddings) => {
  if (FACE_ENGINE !== "python") {
    return evaluateMatch(inputEmbedding, storedEmbeddings);
  }

  try {
    const response = await fetch(`${PYTHON_FACE_ENGINE_URL}/face/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embedding: inputEmbedding,
        stored_embeddings: storedEmbeddings,
        threshold: FACE_DISTANCE_THRESHOLD
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Python engine verify failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    return {
      matched: Boolean(payload.matched),
      distance: Number(payload.match_distance),
      score: Number(payload.match_score)
    };
  } catch (error) {
    // If Python service is down, fallback to local matching so ERP remains functional.
    return evaluateMatch(inputEmbedding, storedEmbeddings);
  }
};

const toBase64Url = (value) =>
  Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromBase64Url = (value) => {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  return Buffer.from(normalized, "base64").toString("utf8");
};

export const signChallenge = ({ userId, timetableId, ttlSeconds = 180 }) => {
  const payload = {
    userId: String(userId),
    timetableId: String(timetableId),
    exp: Date.now() + ttlSeconds * 1000,
    nonce: crypto.randomBytes(8).toString("hex")
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    crypto.createHmac("sha256", CHALLENGE_SECRET).update(encoded).digest("hex")
  );
  return `${encoded}.${signature}`;
};

export const verifyChallenge = (token, expectedUserId, expectedTimetableId) => {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, message: "Challenge token missing." };
  }

  const [encoded, signature] = token.split(".");
  const expectedSignature = toBase64Url(
    crypto.createHmac("sha256", CHALLENGE_SECRET).update(encoded).digest("hex")
  );
  if (signature !== expectedSignature) {
    return { ok: false, message: "Invalid challenge token signature." };
  }

  let payload = null;
  try {
    payload = JSON.parse(fromBase64Url(encoded));
  } catch {
    return { ok: false, message: "Invalid challenge payload." };
  }

  if (Date.now() > Number(payload.exp || 0)) {
    return { ok: false, message: "Challenge expired. Please refresh and try again." };
  }

  if (String(payload.userId) !== String(expectedUserId)) {
    return { ok: false, message: "Challenge user mismatch." };
  }

  if (String(payload.timetableId) !== String(expectedTimetableId)) {
    return { ok: false, message: "Challenge class mismatch." };
  }

  return { ok: true, payload };
};

export const parseTimeToDate = (dateRef, hhmm) => {
  const [hour, minute] = String(hhmm || "")
    .split(":")
    .map((value) => Number(value));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const date = new Date(dateRef);
  date.setHours(hour, minute, 0, 0);
  return date;
};

export const todayDateKey = (dateRef = new Date()) => {
  const yyyy = dateRef.getFullYear();
  const mm = String(dateRef.getMonth() + 1).padStart(2, "0");
  const dd = String(dateRef.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const dayLabel = (dateRef = new Date()) =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateRef.getDay()];

export const computeSlotWindow = (slot, now = new Date(), windowMinutes = DEFAULT_WINDOW_MINUTES) => {
  const classStartAt = parseTimeToDate(now, slot.startTime);
  const classEndAt = parseTimeToDate(now, slot.endTime);
  if (!classStartAt || !classEndAt) {
    return {
      classStartAt: null,
      classEndAt: null,
      windowEndAt: null,
      isClassRunning: false,
      isWithinWindow: false
    };
  }

  const rawWindowEnd = new Date(classStartAt.getTime() + windowMinutes * 60 * 1000);
  const windowEndAt =
    rawWindowEnd.getTime() < classEndAt.getTime() ? rawWindowEnd : classEndAt;

  const isClassRunning = now >= classStartAt && now <= classEndAt;
  const isWithinWindow = now >= classStartAt && now <= windowEndAt;

  return { classStartAt, classEndAt, windowEndAt, isClassRunning, isWithinWindow };
};

export const validateLiveness = (liveness, challengeToken, userId, timetableId) => {
  if (!liveness || typeof liveness !== "object") {
    return { ok: false, message: "Liveness data is required." };
  }

  const blinkCount = Number(liveness.blinkCount);
  const headTurnAngle = Number(liveness.headTurnAngle);
  const stableFrames = Number(liveness.stableFrames);
  const hasBlink = !Number.isNaN(blinkCount) && blinkCount >= 1;
  const hasHeadTurn = !Number.isNaN(headTurnAngle) && headTurnAngle >= 8;
  const hasStableLiveFace = !Number.isNaN(stableFrames) && stableFrames >= 3;
  if (!hasBlink && !hasHeadTurn && !hasStableLiveFace) {
    return {
      ok: false,
      message: "Liveness check failed. Keep your face clearly visible, blink once, or turn your head slightly."
    };
  }

  const challenge = verifyChallenge(challengeToken, userId, timetableId);
  if (!challenge.ok) return challenge;

  return {
    ok: true,
    blinkCount: Number.isNaN(blinkCount) ? 0 : blinkCount,
    headTurnAngle: Number.isNaN(headTurnAngle) ? 0 : headTurnAngle,
    stableFrames: Number.isNaN(stableFrames) ? 0 : stableFrames
  };
};

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const validateAccessConstraints = ({ req, location }) => {
  const allowedPrefixes = String(process.env.ATTENDANCE_ALLOWED_IP_PREFIXES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const clientIp = String(req.ip || req.socket?.remoteAddress || "");

  if (allowedPrefixes.length > 0) {
    const allowed = allowedPrefixes.some((prefix) => clientIp.startsWith(prefix));
    if (!allowed) {
      return { ok: false, status: 403, message: "Attendance allowed only from campus network." };
    }
  }

  const campusLat = Number(process.env.CAMPUS_LAT || NaN);
  const campusLng = Number(process.env.CAMPUS_LNG || NaN);
  const campusRadius = Number(process.env.CAMPUS_RADIUS_METERS || 0);
  if (!Number.isNaN(campusLat) && !Number.isNaN(campusLng) && campusRadius > 0) {
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return { ok: false, status: 400, message: "Location required for attendance." };
    }
    const distance = haversineMeters(campusLat, campusLng, lat, lng);
    if (distance > campusRadius) {
      return { ok: false, status: 403, message: "You are outside allowed attendance zone." };
    }
  }

  return { ok: true, ipAddress: clientIp };
};

export const attendanceConfig = {
  FACE_DISTANCE_THRESHOLD,
  DEFAULT_WINDOW_MINUTES,
  FACE_ENGINE,
  PYTHON_FACE_ENGINE_URL
};
