const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const addCourse = (values, course) => {
  const normalized = String(course || "").trim().toUpperCase();
  if (normalized) values.add(normalized);
};

export const getDepartmentCourseCode = (department) =>
  String(department?.code || department?.departmentId?.code || "").trim().toUpperCase();

export const buildCourseOptions = ({
  departments = [],
  users = [],
  subjects = [],
  semesterFees = [],
  classSections = [],
  timetables = []
} = {}) => {
  const values = new Set();

  departments.forEach((department) => addCourse(values, department.code));
  users.forEach((row) => addCourse(values, row.course));
  subjects.forEach((row) => addCourse(values, row.course));
  semesterFees.forEach((row) => addCourse(values, row.course));

  classSections.forEach((section) => {
    addCourse(values, getDepartmentCourseCode(section));
    const nameCourse = String(section?.name || "").match(/^([A-Za-z0-9]+)/)?.[1];
    addCourse(values, nameCourse);
  });

  timetables.forEach((slot) => {
    addCourse(values, slot?.subjectId?.course);
    addCourse(values, getDepartmentCourseCode(slot?.classSectionId));
    const nameCourse = String(slot?.classSectionId?.name || "").match(/^([A-Za-z0-9]+)/)?.[1];
    addCourse(values, nameCourse);
  });

  return [...values].sort((a, b) => collator.compare(a, b));
};
