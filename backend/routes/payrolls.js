import Payroll from "../models/Payroll.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Payroll, {
  populate: "facultyId",
  queryFilter: (q) => {
    const filter = {};
    if (q.facultyId) filter.facultyId = q.facultyId;
    if (q.status) filter.status = q.status;
    return filter;
  }
});
