import AdmissionApplication from "../models/AdmissionApplication.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(AdmissionApplication, {
  populate: "desiredDepartmentId",
  queryFilter: (q) => (q.status ? { status: q.status } : {})
});
