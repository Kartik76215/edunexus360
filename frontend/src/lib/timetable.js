export const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayRank = new Map(WEEKDAY_ORDER.map((day, index) => [day, index]));

export const compareTimetableSlots = (a, b) => {
  const dayDiff = (dayRank.get(a?.dayOfWeek) ?? 99) - (dayRank.get(b?.dayOfWeek) ?? 99);
  if (dayDiff !== 0) return dayDiff;

  const startDiff = String(a?.startTime || "").localeCompare(String(b?.startTime || ""));
  if (startDiff !== 0) return startDiff;

  return String(a?.room || "").localeCompare(String(b?.room || ""), undefined, { numeric: true });
};

export const sortTimetableSlots = (rows = []) => [...rows].sort(compareTimetableSlots);
