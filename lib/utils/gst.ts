export type InclusiveTaxBreakdown = {
  mrp: number;
  gstRate: number;
  basePrice: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cgstIncludedRate: number;
  sgstIncludedRate: number;
};

export function calculateInclusiveTaxBreakdown(mrp: number, gstRate: number): InclusiveTaxBreakdown {
  const normalizedMrp = Number.isFinite(mrp) ? Number(mrp) : 0;
  const normalizedGstRate = Number.isFinite(gstRate) ? Number(gstRate) : 0;

  if (normalizedGstRate <= 0) {
    return {
      mrp: normalizedMrp,
      gstRate: 0,
      basePrice: normalizedMrp,
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cgstIncludedRate: 0,
      sgstIncludedRate: 0,
    };
  }

  const basePrice = normalizedMrp / (1 + normalizedGstRate / 100);
  const gstAmount = normalizedMrp - basePrice;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;
  const cgstIncludedRate = (normalizedGstRate / (2 * (100 + normalizedGstRate))) * 100;

  return {
    mrp: normalizedMrp,
    gstRate: normalizedGstRate,
    basePrice,
    gstAmount,
    cgstAmount,
    sgstAmount,
    cgstIncludedRate,
    sgstIncludedRate: cgstIncludedRate,
  };
}
