import AcademicYear from "../models/AcademicYear.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(AcademicYear, { defaultSort: { startDate: -1 } });
