import { Pill, PillBottle, FlaskConical, Syringe, Droplet, Package } from 'lucide-react';

// The catalog (bulk-imported from a CSV) has no per-item photography, so
// there's no real "image" to show for a medicine. Instead of one flat
// Pill symbol standing in for every item regardless of what it actually
// is, this infers a dosage form from the pack size label (e.g. "strip of
// 10 tablets", "vial of 2ml Injection") and, as a backup, the medicine
// name — then maps that to a distinct icon + color so tablets, capsules,
// syrups, injections, drops, and topicals all look visually different.
//
// Order matters: more specific keywords are checked first so labels like
// "Powder for Injection" land in injection rather than topical, and
// "Eye Drop" lands in drops rather than being swallowed by a broader rule.
const CATEGORY_RULES = [
  { key: 'injection', icon: Syringe, tint: '--red-tint', color: '--red', keywords: ['injection', 'infusion', 'vial'] },
  { key: 'drops', icon: Droplet, tint: '--teal-tint', color: '--teal', keywords: ['drop', 'ophthalmic'] },
  { key: 'liquid', icon: FlaskConical, tint: '--green-tint', color: '--green', keywords: ['syrup', 'suspension', 'solution', 'expectorant', 'elixir'] },
  {
    key: 'topical',
    icon: Package,
    tint: '--amber-tint',
    color: '--amber',
    keywords: ['cream', 'ointment', 'gel', 'lotion', 'soap', 'shampoo', 'powder', 'dusting'],
  },
  { key: 'capsule', icon: PillBottle, tint: '--amber-tint', color: '--amber', keywords: ['capsule'] },
  { key: 'tablet', icon: Pill, tint: '--teal-tint', color: '--teal', keywords: ['tablet'] },
];

// Fall back to the tablet look when nothing matches — it's the most
// common form in the catalog and matches the original default icon.
const DEFAULT_VISUAL = CATEGORY_RULES[CATEGORY_RULES.length - 1];

export function getMedicineVisual(medicine) {
  const haystack = `${medicine?.packSizeLabel || ''} ${medicine?.name || ''} ${medicine?.type || ''}`.toLowerCase();
  return CATEGORY_RULES.find((rule) => rule.keywords.some((kw) => haystack.includes(kw))) || DEFAULT_VISUAL;
}
