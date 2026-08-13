export function parsePrice(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function formatZar(value: string | number): string {
  const grouped = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 })
    .format(parsePrice(value))
    .replace(/[,\u00A0\u202F]/g, " ");
  return `R${grouped}`;
}
