import Enrollment from "../models/Enrollment.js";
import Subject from "../models/Subject.js";
import Timetable from "../models/Timetable.js";
import User from "../models/User.js";
import { buildCrudRouter } from "./crudFactory.js";

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dayOrder = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const compareTimetableSlots = (a, b) => {
  const dayDiff = (dayOrder[a.dayOfWeek] || 99) - (dayOrder[b.dayOfWeek] || 99);
  if (dayDiff !== 0) return dayDiff;
  const timeDiff = String(a.startTime || "").localeCompare(String(b.startTime || ""));
  if (timeDiff !== 0) return timeDiff;
  return String(a.room || "").localeCompare(String(b.room || ""), undefined, { numeric: true });
};

export default buildCrudRouter(Timetable, {
  populate: "classSectionId subjectId facultyId",
  responseSort: compareTimetableSlots,
  queryFilter: async (q) => {
    const filter = {};

    if (q.classSectionId) filter.classSectionId = q.classSectionId;
    if (q.facultyId) filter.facultyId = q.facultyId;
    if (q.dayOfWeek) filter.dayOfWeek = q.dayOfWeek;

    if (q.studentId) {
      const user = await User.findById(q.studentId).select("course semester");
      const enrollments = await Enrollment.find({
        studentId: q.studentId,
        status: "active"
      }).select("classSectionId");
      const classSectionIds = enrollments.map((row) => row.classSectionId);

      const course = String(user?.course || "").trim();
      const semester = Number(user?.semester || 0);
      let subjectIds = [];

      if (course && semester > 0) {
        const subjects = await Subject.find({
          course: { $regex: `^${escapeRegex(course)}$`, $options: "i" },
          semester
        }).select("_id");
        subjectIds = subjects.map((row) => row._id);
      }

      if (classSectionIds.length > 0 && subjectIds.length > 0) {
        filter.$or = [
          { classSectionId: { $in: classSectionIds } },
          { subjectId: { $in: subjectIds } }
        ];
      } else if (classSectionIds.length > 0) {
        filter.classSectionId = { $in: classSectionIds };
      } else if (subjectIds.length > 0) {
        filter.subjectId = { $in: subjectIds };
      } else {
        filter._id = null;
      }

      return filter;
    }

    if (q.course || q.semester !== undefined) {
      const subjectFilter = {};
      if (q.course) {
        subjectFilter.course = {
          $regex: `^${escapeRegex(String(q.course).trim())}$`,
          $options: "i"
        };
      }
      if (q.semester !== undefined) {
        const sem = Number(q.semester);
        if (!Number.isNaN(sem)) subjectFilter.semester = sem;
      }

      const subjects = await Subject.find(subjectFilter).select("_id");
      const subjectIds = subjects.map((row) => row._id);
      if (subjectIds.length === 0) {
        filter._id = null;
      } else {
        filter.subjectId = { $in: subjectIds };
      }
    }

    return filter;
  }
});
