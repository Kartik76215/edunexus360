import Semester from "../models/Semester.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Semester, {
  populate: "academicYearId",
  defaultSort: { number: 1 },
  queryFilter: (q) => (q.academicYearId ? { academicYearId: q.academicYearId } : {})
});
