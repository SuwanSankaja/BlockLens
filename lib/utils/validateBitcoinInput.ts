import type { SearchEntityKind } from "@/types/blockchain";

const TXID_REGEX = /^[a-fA-F0-9]{64}$/;
const BECH32_REGEX = /^(bc1|tb1|bcrt1)[ac-hj-np-z02-9]{11,71}$/i;
const BASE58_REGEX = /^[123mn2][a-km-zA-HJ-NP-Z1-9]{24,61}$/;

export interface BitcoinInputDetection {
  input: string;
  normalized: string;
  kind: SearchEntityKind | "unknown";
  isValid: boolean;
  reason?: string;
}

export function detectBitcoinInputType(rawInput: string): BitcoinInputDetection {
  const input = rawInput.trim();
  const normalized = input.toLowerCase();

  if (!input) {
    return {
      input,
      normalized,
      kind: "unknown",
      isValid: false,
      reason: "Enter a Bitcoin transaction ID or address.",
    };
  }

  if (TXID_REGEX.test(input)) {
    return {
      input,
      normalized,
      kind: "transaction",
      isValid: true,
    };
  }

  if (BECH32_REGEX.test(input) || BASE58_REGEX.test(input)) {
    return {
      input,
      normalized: input,
      kind: "address",
      isValid: true,
    };
  }

  return {
    input,
    normalized,
    kind: "unknown",
    isValid: false,
    reason: "Input is not a recognizable Bitcoin txid or address.",
  };
}
