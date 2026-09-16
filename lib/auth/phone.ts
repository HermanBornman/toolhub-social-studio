const JOHANNESBURG_OFFSET_MS = 2 * 60 * 60 * 1000;

export function normalizeSouthAfricanMobile(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const local = compact.startsWith("+27") ? `0${compact.slice(3)}` : compact.startsWith("27") ? `0${compact.slice(2)}` : compact;
  if (!/^0[6-8]\d{8}$/.test(local)) throw new Error("INVALID_PHONE");
  return { mobileNumber: local, mobileE164: `+27${local.slice(1)}` };
}

function johannesburgParts(value: Date) {
  const local = new Date(value.getTime() + JOHANNESBURG_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), date: local.getUTCDate(), day: local.getUTCDay() };
}

export function fiveWorkingDayExpiry(start: Date) {
  const first = johannesburgParts(start);
  let cursor = new Date(Date.UTC(first.year, first.month, first.date));
  let counted = 0;
  while (counted < 5) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) counted += 1;
    if (counted < 5) cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  // 23:59:59.999 in Africa/Johannesburg on the fifth working day.
  return new Date(cursor.getTime() + 24 * 60 * 60 * 1000 - 1 - JOHANNESBURG_OFFSET_MS);
}

export function cookieSeconds(expiresAt: Date, now = new Date()) {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}
