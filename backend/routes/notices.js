import Notice from "../models/Notice.js";
import { buildCrudRouter } from "./crudFactory.js";

export default buildCrudRouter(Notice, {
  populate: "createdBy classSectionId",
  queryFilter: (q) => {
    const filter = {};
    if (q.audience) filter.audience = q.audience;
    if (q.noticeType) filter.noticeType = q.noticeType;
    if (q.classSectionId) filter.classSectionId = q.classSectionId;
    return filter;
  }
});
