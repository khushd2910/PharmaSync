// There's no per-item product photography in the catalog, so every card
// shows a generic illustration keyed off the medicine's category (curated
// at import time from server/data/commonMolecules.js). Uncategorized or
// unrecognized categories fall back to a neutral capsule/tablet graphic.
const CATEGORY_IMAGES = {
  'pain relief': '/images/medicine-categories/pain-relief.svg',
  antibiotic: '/images/medicine-categories/antibiotic.svg',
  allergy: '/images/medicine-categories/allergy.svg',
  diabetes: '/images/medicine-categories/diabetes.svg',
  'heart & blood pressure': '/images/medicine-categories/heart-blood-pressure.svg',
  'gastro & digestion': '/images/medicine-categories/gastro-digestion.svg',
  'cough, cold & respiratory': '/images/medicine-categories/cough-cold-respiratory.svg',
  thyroid: '/images/medicine-categories/thyroid.svg',
  'vitamins & supplements': '/images/medicine-categories/vitamins-supplements.svg',
  'skin care': '/images/medicine-categories/skin-care.svg',
  'first aid & rehydration': '/images/medicine-categories/first-aid-rehydration.svg',
};

const DEFAULT_IMAGE = '/images/medicine-categories/default.svg';

export const getCategoryImage = (category) => {
  if (!category) return DEFAULT_IMAGE;
  return CATEGORY_IMAGES[category.trim().toLowerCase()] || DEFAULT_IMAGE;
};

export default getCategoryImage;
