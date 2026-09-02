export function calculateSellingPrice(cost: number, markup = 55.8) {
return Math.round(cost * (1 + markup / 100));
}

export function formatPrice(value: string | number) {
const numeric = typeof value === "number" ? value : Number(value.replace(/[^0-9.]/g, ""));
return `R${Number.isFinite(numeric) ? Math.round(numeric).toLocaleString("en-ZA") : "0"}`;
}
