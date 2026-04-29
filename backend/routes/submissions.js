import Submission from "../models/Submission.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Submission, {
  populate: "assignmentId studentId",
  queryFilter: (q) => {
    const filter = {};
    if (q.assignmentId) filter.assignmentId = q.assignmentId;
    if (q.studentId) filter.studentId = q.studentId;
    return filter;
  }
});
