import Department from "../models/Department.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Department, { defaultSort: { name: 1 } });
