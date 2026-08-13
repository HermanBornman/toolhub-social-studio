const test = require("node:test");
const assert = require("node:assert/strict");
const { formatZar, parsePrice } = require("../.test-dist/lib/format-price.js");

test("formats South African Rand without decimals", () => {
  for (const [input, expected] of [[999,"R999"],[1179,"R1 179"],[2499,"R2 499"],[4999,"R4 999"],[12500,"R12 500"]]) assert.equal(formatZar(input), expected);
});

test("normalizes formatted price input", () => assert.equal(parsePrice("R 2 499"), 2499));

