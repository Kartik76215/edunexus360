import Grade from "../models/Grade.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Grade, {
  populate: "examId studentId",
  queryFilter: (q) => {
    const filter = {};
    if (q.examId) filter.examId = q.examId;
    if (q.studentId) filter.studentId = q.studentId;
    return filter;
  }
});
