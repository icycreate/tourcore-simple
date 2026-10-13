export function canManage(role) {
  return ["Owner", "Admin", "Operations"].includes(role);
}
export function canAccount(role) {
  return ["Owner", "Admin", "Accounting"].includes(role);
}
export function canTeam(role) {
  return ["Owner", "Admin"].includes(role);
}
export function nextStatuses(status) {
  return (
    {
      Draft: ["Planned", "Cancelled"],
      Planned: ["Draft", "Ongoing", "Cancelled"],
      Ongoing: ["Completed", "Cancelled"],
      Completed: [],
      Cancelled: [],
    }[status] || []
  );
}
export function inPeriod(date, period, today) {
  const d = new Date(date + "T12:00:00");
  const n = new Date(today + "T12:00:00");
  if (period === "Daily") return date === today;
  if (period === "Weekly") {
    const day = (n.getDay() + 6) % 7;
    n.setDate(n.getDate() - day);
    return d >= n && d < new Date(n.getTime() + 7 * 86400000);
  }
  if (period === "Monthly") return date.slice(0, 7) === today.slice(0, 7);
  if (period === "Yearly") return date.slice(0, 4) === today.slice(0, 4);
  return true;
}
