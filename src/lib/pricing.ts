export const PRICE_SINGLE_PENCE = 500;
export const PRICE_FIVE_PACK_PENCE = 2000;
export const PRICE_WHOLE_GALLERY_PENCE = 5000;

export type PriceTiers = {
  singlePence: number;
  fivePackPence: number;
  galleryPence: number;
};

export const DEFAULT_TIERS: PriceTiers = {
  singlePence: PRICE_SINGLE_PENCE,
  fivePackPence: PRICE_FIVE_PACK_PENCE,
  galleryPence: PRICE_WHOLE_GALLERY_PENCE,
};

/** Normalises a row from `events` into a usable tier set. */
export function tiersFromEvent(event: {
  price_single_pence?: number | null;
  price_five_pence?: number | null;
  price_gallery_pence?: number | null;
} | null | undefined): PriceTiers {
  return {
    singlePence: event?.price_single_pence ?? PRICE_SINGLE_PENCE,
    fivePackPence: event?.price_five_pence ?? PRICE_FIVE_PACK_PENCE,
    galleryPence: event?.price_gallery_pence ?? PRICE_WHOLE_GALLERY_PENCE,
  };
}

/**
 * Per-photo price, bundles of five, capped at the whole-gallery price.
 * Tiers are per event and always resolved server-side — the client never
 * supplies an amount.
 */
export function priceForSelection(
  selectedCount: number,
  galleryCount: number,
  tiers: PriceTiers = DEFAULT_TIERS,
): number {
  if (selectedCount <= 0) return 0;
  if (galleryCount > 0 && selectedCount >= galleryCount) return tiers.galleryPence;
  const blocks = Math.floor(selectedCount / 5);
  const rest = selectedCount % 5;
  const total = blocks * tiers.fivePackPence + rest * tiers.singlePence;
  return Math.min(total, tiers.galleryPence);
}

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}
