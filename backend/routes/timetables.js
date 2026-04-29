import Timetable from "../models/Timetable.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Timetable, {
  populate: "classSectionId subjectId facultyId",
  queryFilter: (q) => {
    const filter = {};
    if (q.classSectionId) filter.classSectionId = q.classSectionId;
    if (q.facultyId) filter.facultyId = q.facultyId;
    return filter;
  }
});
