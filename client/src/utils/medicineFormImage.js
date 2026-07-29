// Real, openly-licensed photographs (Wikimedia Commons), one per dosage
// FORM — tablet, capsule, syrup, injection, etc. This is deliberately a
// different axis than `medicine.category` (Pain Relief, Antibiotic, ...):
// the catalog (imported from a public Indian medicine dataset) has no
// dedicated dosage-form field, so the form is inferred here from the
// medicine's name + packSizeLabel (e.g. "strip of 10 tablets", "bottle of
// 100 ml Syrup", "vial"). Every medicine of the same form shows the same
// photo, same as real storefronts do for items with no individual
// photography on file.
//
// Sources (Wikimedia Commons, served via the stable Special:FilePath
// redirect — Commons' own hotlink-friendly resolver, so the URL keeps
// working even if the underlying file is renamed or rescaled):
//   tablet    - File:Pill 3.jpg (CC0)
//   capsule   - File:Antibiotic pills.jpg (CC BY-SA 4.0, Maksym Kozlenko)
//   syrup     - File:Sirop toux.jpg (CC BY-SA 3.0, Warp3)
//   injection - File:Syringe2.jpg (public domain)
//   cream     - File:Tube of hydrocortisone cream.jpg (CC BY-SA 4.0, Father Goose)
//   drops     - File:Ocuheel Medication.jpg (CC BY-SA, Gustamons)
//   inhaler   - File:AsthmaInhaler.jpg (public domain, self-released)
//   sachet    - File:UNICEF-ORS.jpg (CC BY-SA 4.0, UNICEF)
// CC BY-SA entries should be credited to their Commons page if this
// catalog is ever published outside a coursework/demo context.
const COMMONS_PATH = 'https://commons.wikimedia.org/wiki/Special:FilePath/';

const FORM_IMAGES = {
  tablet: `${COMMONS_PATH}Pill%203.jpg`,
  capsule: `${COMMONS_PATH}Antibiotic%20pills.jpg`,
  syrup: `${COMMONS_PATH}Sirop%20toux.jpg`,
  injection: `${COMMONS_PATH}Syringe2.jpg`,
  cream: `${COMMONS_PATH}Tube%20of%20hydrocortisone%20cream.jpg`,
  drops: `${COMMONS_PATH}Ocuheel%20Medication.jpg`,
  inhaler: `${COMMONS_PATH}AsthmaInhaler.jpg`,
  sachet: `${COMMONS_PATH}UNICEF-ORS.jpg`,
};

// Ordered most-specific-first — e.g. "Oral Rehydration Salts Sachet" should
// hit `sachet` before the generic `tablet` fallback ever gets a chance.
const FORM_RULES = [
  ['injection', /\b(injection|inj|vial|ampoule|ampule)\b/i],
  ['syrup', /\b(syrup|suspension|oral liquid|elixir)\b/i],
  ['inhaler', /\b(inhaler|respules?|rotacap|inhalation|nasal spray|spray)\b/i],
  ['drops', /\bdrops?\b/i],
  ['cream', /\b(cream|ointment|gel|lotion|soap|shampoo)\b/i],
  ['sachet', /\b(sachet|powder|\bors\b)\b/i],
  ['capsule', /\bcapsules?\b/i],
  ['tablet', /\btablets?\b/i],
];

export const getMedicineForm = (medicine) => {
  const text = `${medicine?.name || ''} ${medicine?.packSizeLabel || ''}`;
  for (const [form, pattern] of FORM_RULES) {
    if (pattern.test(text)) return form;
  }
  return 'tablet';
};

export const getMedicineImage = (medicine) => FORM_IMAGES[getMedicineForm(medicine)] || FORM_IMAGES.tablet;

export default getMedicineImage;
