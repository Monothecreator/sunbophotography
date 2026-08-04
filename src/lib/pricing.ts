export const PRICE_SINGLE_PENCE = 500;
export const PRICE_FIVE_PACK_PENCE = 2000;
export const PRICE_WHOLE_GALLERY_PENCE = 5000;

/** £5 per photo, £20 per block of five, capped at £50 for the whole gallery. */
export function priceForSelection(selectedCount: number, galleryCount: number): number {
  if (selectedCount <= 0) return 0;
  if (galleryCount > 0 && selectedCount >= galleryCount) return PRICE_WHOLE_GALLERY_PENCE;
  const blocks = Math.floor(selectedCount / 5);
  const rest = selectedCount % 5;
  const total = blocks * PRICE_FIVE_PACK_PENCE + rest * PRICE_SINGLE_PENCE;
  return Math.min(total, PRICE_WHOLE_GALLERY_PENCE);
}

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}
