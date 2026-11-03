import { describe, expect, it } from "vitest";
import { detectBitcoinInputType } from "@/lib/utils/validateBitcoinInput";
import { GENESIS, TXID } from "./helpers";

describe("detectBitcoinInputType", () => {
  it("detects txid, trimming whitespace", () => {
    expect(detectBitcoinInputType(` ${TXID} `)).toMatchObject({ kind: "transaction", isValid: true });
  });
  it("detects legacy and bech32 addresses", () => {
    expect(detectBitcoinInputType(GENESIS)).toMatchObject({ kind: "address", isValid: true });
    expect(detectBitcoinInputType("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq").kind).toBe("address");
  });
  it.each(["", "   ", "abc", "a".repeat(63), "a".repeat(65), "g".repeat(64), "../../foo", "address:" + GENESIS, GENESIS + "/x", "<script>"])(
    "rejects %j",
    (v) => {
      const r = detectBitcoinInputType(v);
      expect(r.isValid).toBe(false);
      expect(r.kind).toBe("unknown");
      expect(r.reason).toBeTruthy();
    },
  );
});
