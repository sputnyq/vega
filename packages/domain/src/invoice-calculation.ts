type Entry = { quantity: number; unitPrice: number };
type Decimal = { coefficient: bigint; scale: number };

/** Decimal arithmetic without intermediate cent/line rounding, matching the accounting documents. */
export function calculateInvoiceTotals(entries: readonly Entry[], taxPercent: number) {
  const net = entries.reduce((sum, entry) => add(sum, multiply(decimal(entry.quantity), decimal(entry.unitPrice))), decimal(0));
  const product = multiply(net, decimal(taxPercent));
  const tax = { coefficient: product.coefficient, scale: product.scale + 2 };
  return { net: number(net), tax: number(tax), total: number(add(net, tax)) };
}

export function invoiceLineTotal(entry: Entry): number {
  return number(multiply(decimal(entry.quantity), decimal(entry.unitPrice)));
}

export function addInvoiceAmounts(amounts: readonly number[]): number {
  return number(amounts.reduce((sum, amount) => add(sum, decimal(amount)), decimal(0)));
}

export function roundAmountToCents(value: number): number {
  return number(roundToScale(decimal(value), 2));
}

export function roundAmountToNearestIncrement(value: number, increment: number): number {
  return roundProductToNearestIncrement([value], increment);
}

export function roundProductToNearestIncrement(factors: readonly number[], increment: number): number {
  if (!Number.isFinite(increment) || increment <= 0) throw new RangeError("Rounding increment must be positive.");
  if (factors.some((factor) => !Number.isFinite(factor))) throw new RangeError("Amounts must be finite.");
  const amount = factors.reduce((product, factor) => multiply(product, decimal(factor)), decimal(1));
  const step = decimal(increment);
  const scale = Math.max(amount.scale, step.scale);
  const amountUnits = amount.coefficient * 10n ** BigInt(scale - amount.scale);
  const stepUnits = step.coefficient * 10n ** BigInt(scale - step.scale);
  if (stepUnits <= 0n) throw new RangeError("Rounding increment must be positive.");
  const sign = amountUnits < 0n ? -1n : 1n;
  const magnitude = amountUnits < 0n ? -amountUnits : amountUnits;
  return number({ coefficient: sign * ((magnitude + stepUnits / 2n) / stepUnits) * stepUnits, scale });
}

export function calculateRoundedSubtotal(entries: readonly Entry[]): number {
  const subtotal = entries.reduce(
    (sum, entry) => add(sum, multiply(decimal(entry.quantity), decimal(entry.unitPrice))),
    decimal(0),
  );
  return number(roundToScale(subtotal, 2));
}

export function calculateRoundedPercent(amount: number, percent: number): number {
  const base = decimal(amount);
  const rate = decimal(percent);
  return number(roundToScale({
    coefficient: base.coefficient * rate.coefficient,
    scale: base.scale + rate.scale + 2,
  }, 2));
}

/** Preserve the existing reminder rounding rule; totals themselves are not rounded. */
export function roundInvoiceAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToScale(value: Decimal, scale: number): Decimal {
  if (value.scale <= scale) return { coefficient: value.coefficient * 10n ** BigInt(scale - value.scale), scale };
  const divisor = 10n ** BigInt(value.scale - scale);
  const sign = value.coefficient < 0n ? -1n : 1n;
  const magnitude = value.coefficient < 0n ? -value.coefficient : value.coefficient;
  return { coefficient: sign * ((magnitude + divisor / 2n) / divisor), scale };
}

function decimal(value: number): Decimal {
  if (!Number.isFinite(value)) throw new RangeError("Invoice amounts must be finite.");
  const [mantissa = "0", exponent = "0"] = String(value).split("e");
  const fractionLength = mantissa.split(".")[1]?.length ?? 0;
  const scale = fractionLength - Number(exponent);
  const coefficient = BigInt(mantissa.replace(".", ""));
  return scale < 0 ? { coefficient: coefficient * 10n ** BigInt(-scale), scale: 0 } : { coefficient, scale };
}

function add(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale);
  return {
    coefficient: left.coefficient * 10n ** BigInt(scale - left.scale) + right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  };
}

function multiply(left: Decimal, right: Decimal): Decimal {
  return { coefficient: left.coefficient * right.coefficient, scale: left.scale + right.scale };
}

function number(value: Decimal): number {
  return Number(`${value.coefficient}e-${value.scale}`);
}
