// JSON.stringify can't serialize bigint, so we emit it as a decimal string.
// AtomicUsdc is a branded bigint used everywhere, so responses would crash without this.
// Clients parse back with BigInt(field). Must load before any response is serialized.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function toJSON(this: bigint): string {
  return this.toString();
};

export {};
