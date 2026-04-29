import Enrollment from "../models/Enrollment.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Enrollment, {
  populate: "studentId classSectionId",
  queryFilter: (q) => {
    const filter = {};
    if (q.studentId) filter.studentId = q.studentId;
    if (q.classSectionId) filter.classSectionId = q.classSectionId;
    return filter;
  }
});
