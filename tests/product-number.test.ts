import { describe, expect, it } from "vitest";
import { formatProductNumber } from "../lib/product-number";

describe("product numbers", () => {
  it("pads regular auction IDs to a readable six-digit number", () => {
    expect(formatProductNumber(1)).toBe("MZ-000001");
    expect(formatProductNumber(42)).toBe("MZ-000042");
  });

  it("does not truncate IDs longer than six digits", () => {
    expect(formatProductNumber(1_234_567)).toBe("MZ-1234567");
  });
});
