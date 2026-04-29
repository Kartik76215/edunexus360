import express from "express";
import mongoose from "mongoose";

export const buildCrudRouter = (Model, options = {}) => {
  const router = express.Router();
  const {
    populate = "",
    defaultSort = { createdAt: -1 },
    queryFilter = null,
    responseSort = null
  } = options;

  router.get("/", async (req, res) => {
    try {
      const extraFilter = queryFilter ? await queryFilter(req.query) : {};
      let q = Model.find(extraFilter).sort(defaultSort);
      if (populate) q = q.populate(populate);
      const rows = await q;
      res.json(responseSort ? [...rows].sort(responseSort) : rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid id." });
      }
      let q = Model.findById(req.params.id);
      if (populate) q = q.populate(populate);
      const row = await q;
      if (!row) return res.status(404).json({ message: "Not found." });
      res.json(row);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const created = await Model.create(req.body);
      let q = Model.findById(created._id);
      if (populate) q = q.populate(populate);
      const row = await q;
      res.status(201).json(row);
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ message: "Duplicate entry." });
      }
      res.status(400).json({ error: error.message });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid id." });
      }
      const updated = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      });
      if (!updated) return res.status(404).json({ message: "Not found." });
      let q = Model.findById(updated._id);
      if (populate) q = q.populate(populate);
      const row = await q;
      res.json(row);
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ message: "Duplicate entry." });
      }
      res.status(400).json({ error: error.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid id." });
      }
      const deleted = await Model.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Not found." });
      res.json({ message: "Deleted successfully." });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
