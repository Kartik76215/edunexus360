import Assignment from "../models/Assignment.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Assignment, {
  populate: "subjectId facultyId classSectionId",
  queryFilter: (q) => {
    const filter = {};
    if (q.subjectId) filter.subjectId = q.subjectId;
    if (q.facultyId) filter.facultyId = q.facultyId;
    if (q.classSectionId) filter.classSectionId = q.classSectionId;
    return filter;
  }
});
