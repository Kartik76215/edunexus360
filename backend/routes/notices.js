import express from "express";
import mongoose from "mongoose";
import Notice from "../models/Notice.js";

const router = express.Router();

const NOTICE_TYPES = new Set(["notice", "event", "workshop"]);
const AUDIENCES = new Set(["all", "students", "faculty", "staff", "class"]);
const NOTICE_POPULATE = [
  { path: "createdBy", select: "name email role" },
  { path: "classSectionId", select: "name" }
];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeNotice = (row) => {
  if (!row) return row;
  const plain = typeof row.toObject === "function" ? row.toObject() : row;
  return {
    ...plain,
    noticeType: plain.noticeType || "notice",
    eventDate: plain.eventDate || null,
    imageData: typeof plain.imageData === "string" ? plain.imageData : "",
    imageName: typeof plain.imageName === "string" ? plain.imageName : "",
    audience: plain.audience || "all"
  };
};

const buildFilter = (query) => {
  const filter = {};
  if (AUDIENCES.has(query.audience)) filter.audience = query.audience;
  if (NOTICE_TYPES.has(query.noticeType)) filter.noticeType = query.noticeType;
  if (isValidObjectId(query.classSectionId)) filter.classSectionId = query.classSectionId;
  return filter;
};

const buildPayload = (body, { forUpdate = false } = {}) => {
  const payload = {};

  if (!forUpdate || body.title !== undefined) payload.title = String(body.title || "").trim();
  if (!forUpdate || body.body !== undefined) payload.body = String(body.body || "").trim();

  if (!forUpdate || body.noticeType !== undefined) {
    payload.noticeType = NOTICE_TYPES.has(body.noticeType) ? body.noticeType : "notice";
  }

  if (!forUpdate || body.eventDate !== undefined) {
    payload.eventDate = body.eventDate ? new Date(body.eventDate) : undefined;
  }

  if (!forUpdate || body.imageData !== undefined) {
    payload.imageData =
      typeof body.imageData === "string" && body.imageData.startsWith("data:image/")
        ? body.imageData
        : "";
  }

  if (!forUpdate || body.imageName !== undefined) {
    payload.imageName = typeof body.imageName === "string" ? body.imageName.trim() : "";
  }

  if (!forUpdate || body.audience !== undefined) {
    payload.audience = AUDIENCES.has(body.audience) ? body.audience : "all";
  }

  const classSectionId =
    payload.audience === "class" || body.audience === "class" ? body.classSectionId : undefined;
  if (!forUpdate || body.classSectionId !== undefined || body.audience !== undefined) {
    payload.classSectionId = isValidObjectId(classSectionId) ? classSectionId : undefined;
  }

  if (!forUpdate || body.createdBy !== undefined) {
    payload.createdBy = isValidObjectId(body.createdBy) ? body.createdBy : body.createdBy;
  }

  return payload;
};

const findNoticeById = async (id) => {
  let query = Notice.findById(id);
  for (const spec of NOTICE_POPULATE) query = query.populate(spec);
  return query;
};

router.get("/", async (req, res) => {
  try {
    let query = Notice.find(buildFilter(req.query)).sort({ createdAt: -1 });
    for (const spec of NOTICE_POPULATE) query = query.populate(spec);
    const rows = await query;
    res.json(rows.map(normalizeNotice));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const row = await findNoticeById(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found." });
    res.json(normalizeNotice(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await Notice.create(buildPayload(req.body));
    const row = await findNoticeById(created._id);
    res.status(201).json(normalizeNotice(row));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate entry." });
    }
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const row = await Notice.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found." });

    Object.assign(row, buildPayload(req.body, { forUpdate: true }));
    await row.save();

    const updated = await findNoticeById(row._id);
    res.json(normalizeNotice(updated));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate entry." });
    }
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const deleted = await Notice.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found." });
    res.json({ message: "Deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
