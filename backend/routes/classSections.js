import ClassSection from "../models/ClassSection.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(ClassSection, {
  populate: "departmentId semesterId coordinatorId",
  queryFilter: (q) => {
    const filter = {};
    if (q.departmentId) filter.departmentId = q.departmentId;
    if (q.semesterId) filter.semesterId = q.semesterId;
    return filter;
  }
});
