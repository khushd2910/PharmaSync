// Demo helper: the bulk-imported catalog's pack size data is wildly
// inconsistent (bottles, tubes, vials, packets, and — for the strips that
// do exist — the overwhelming majority are simply labelled "strip of 10"),
// so it doesn't give shoppers a meaningful per-medicine "how many tablets
// come in a strip" signal. This deterministically derives a plausible
// 4-10 count from the medicine's own id instead, so the same medicine
// always shows the same number on every render/refresh without needing a
// database migration. Purely a storefront presentation touch — not real
// packaging data.
const MIN_PER_STRIP = 4;
const MAX_PER_STRIP = 10;
const RANGE = MAX_PER_STRIP - MIN_PER_STRIP + 1;

export const getStripSize = (medicineId) => {
  const id = String(medicineId || '');
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return MIN_PER_STRIP + (hash % RANGE);
};

export default getStripSize;
