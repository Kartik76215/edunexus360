import Exam from "../models/Exam.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Exam, {
  populate: "subjectId classSectionId",
  queryFilter: (q) => {
    const filter = {};
    if (q.subjectId) filter.subjectId = q.subjectId;
    if (q.classSectionId) filter.classSectionId = q.classSectionId;
    return filter;
  }
});
