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

/** Preserve the existing reminder rounding rule; totals themselves are not rounded. */
export function roundInvoiceAmount(value: number): number {
  return Math.round(value * 100) / 100;
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
