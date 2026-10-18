export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weekDates(anchor) {
  const start = new Date(`${anchor}T12:00:00`);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => { const date = new Date(start); date.setDate(start.getDate() + i); return localDate(date); });
}
export function shiftWeek(anchor, offset) {
  const date = new Date(`${anchor}T12:00:00`);
  date.setDate(date.getDate() + offset * 7);
  return localDate(date);
}
