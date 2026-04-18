export function shortenHash(value: string, size = 8): string {
  if (!value) {
    return "Unknown";
  }

  if (value.length <= size * 2) {
    return value;
  }

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function formatSats(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${new Intl.NumberFormat("en-US").format(value)} sats`;
}

export function formatBtc(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${(value / 100_000_000).toFixed(8)} BTC`;
}

export function formatDateTime(unixSeconds?: number): string {
  if (!unixSeconds) {
    return "Unconfirmed";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(unixSeconds * 1000);
}

export function formatFeeRate(
  fee: number | undefined,
  weight: number | undefined,
): string {
  if (typeof fee !== "number" || typeof weight !== "number" || weight <= 0) {
    return "N/A";
  }

  return `${(fee / (weight / 4)).toFixed(2)} sat/vB`;
}
