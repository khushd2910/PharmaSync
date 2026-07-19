/**
 * A curated whitelist of common active ingredients (molecules). The
 * import script only keeps medicines whose composition matches one of
 * these — this is what keeps the catalog small ("extremely common
 * medicines only") instead of importing all 253k+ rows.
 *
 * `uses` / `sideEffects` / `dosage` are brief, general-reference text for
 * demo/educational purposes — NOT medical advice, and deliberately generic
 * (not brand- or dose-specific). `fdaAlias` is the US/openFDA generic name
 * used for the live "fetch additional details" API enrichment, where it
 * differs from the Indian generic name (e.g. Salbutamol → Albuterol).
 */
module.exports = [
  { match: /paracetamol/i, category: 'Pain Relief', requiresPrescription: false, uses: 'Fever and mild to moderate pain relief.', sideEffects: 'Generally well tolerated; rare nausea or rash; liver damage possible in overdose.', dosage: 'As directed by a physician — do not exceed 4g/day for adults.', fdaAlias: 'acetaminophen' },
  { match: /\bibuprofen\b/i, category: 'Pain Relief', requiresPrescription: false, uses: 'Pain, inflammation, and fever relief.', sideEffects: 'Stomach upset, heartburn, dizziness.', dosage: 'As directed by a physician; take with food.', fdaAlias: 'ibuprofen' },
  { match: /diclofenac/i, category: 'Pain Relief', requiresPrescription: true, uses: 'Pain and inflammation from arthritis, injury, or post-surgery.', sideEffects: 'Stomach irritation, headache, dizziness.', dosage: 'As prescribed; take with food.', fdaAlias: 'diclofenac' },
  { match: /\baspirin\b/i, category: 'Pain Relief', requiresPrescription: false, uses: 'Pain relief, fever reduction, and (low-dose) blood-thinning.', sideEffects: 'Stomach irritation, increased bleeding risk.', dosage: 'As directed by a physician.', fdaAlias: 'aspirin' },
  { match: /aceclofenac/i, category: 'Pain Relief', requiresPrescription: true, uses: 'Pain and inflammation relief, commonly for joint pain.', sideEffects: 'Stomach discomfort, nausea.', dosage: 'As prescribed; take with food.', fdaAlias: null },

  { match: /amoxycillin|amoxicillin/i, category: 'Antibiotic', requiresPrescription: true, uses: 'Bacterial infections (respiratory, ear, throat, urinary).', sideEffects: 'Diarrhea, nausea, allergic rash.', dosage: 'As prescribed; complete the full course.', fdaAlias: 'amoxicillin' },
  { match: /azithromycin/i, category: 'Antibiotic', requiresPrescription: true, uses: 'Bacterial infections including respiratory and skin infections.', sideEffects: 'Nausea, diarrhea, stomach pain.', dosage: 'As prescribed; complete the full course.', fdaAlias: 'azithromycin' },
  { match: /ciprofloxacin/i, category: 'Antibiotic', requiresPrescription: true, uses: 'Bacterial infections including urinary tract infections.', sideEffects: 'Nausea, diarrhea, tendon pain (rare).', dosage: 'As prescribed; complete the full course.', fdaAlias: 'ciprofloxacin' },
  { match: /doxycycline/i, category: 'Antibiotic', requiresPrescription: true, uses: 'Bacterial infections, acne, and certain tick-borne illnesses.', sideEffects: 'Sun sensitivity, stomach upset.', dosage: 'As prescribed; complete the full course.', fdaAlias: 'doxycycline' },
  { match: /metronidazole/i, category: 'Antibiotic', requiresPrescription: true, uses: 'Bacterial and certain parasitic infections.', sideEffects: 'Metallic taste, nausea; avoid alcohol.', dosage: 'As prescribed; complete the full course.', fdaAlias: 'metronidazole' },
  { match: /cefixime/i, category: 'Antibiotic', requiresPrescription: true, uses: 'Bacterial infections including respiratory and urinary tract.', sideEffects: 'Diarrhea, nausea, rash.', dosage: 'As prescribed; complete the full course.', fdaAlias: 'cefixime' },

  { match: /levocetirizine/i, category: 'Allergy', requiresPrescription: false, uses: 'Allergy symptoms — sneezing, itching, runny nose.', sideEffects: 'Drowsiness (mild), dry mouth.', dosage: 'As directed, usually once daily.', fdaAlias: null },
  { match: /\bcetirizine\b/i, category: 'Allergy', requiresPrescription: false, uses: 'Allergy symptoms — sneezing, itching, runny nose.', sideEffects: 'Mild drowsiness, dry mouth.', dosage: 'As directed, usually once daily.', fdaAlias: 'cetirizine' },
  { match: /loratadine/i, category: 'Allergy', requiresPrescription: false, uses: 'Allergy symptoms with less drowsiness than older antihistamines.', sideEffects: 'Headache, dry mouth.', dosage: 'As directed, usually once daily.', fdaAlias: 'loratadine' },
  { match: /montelukast/i, category: 'Allergy', requiresPrescription: true, uses: 'Asthma and allergic rhinitis prevention.', sideEffects: 'Headache, stomach pain.', dosage: 'As prescribed, usually once daily in the evening.', fdaAlias: 'montelukast' },

  { match: /\bmetformin\b/i, category: 'Diabetes', requiresPrescription: true, uses: 'Type 2 diabetes — blood sugar control.', sideEffects: 'Stomach upset, nausea (usually improves over time).', dosage: 'As prescribed; take with meals.', fdaAlias: 'metformin' },
  { match: /glimepiride/i, category: 'Diabetes', requiresPrescription: true, uses: 'Type 2 diabetes — blood sugar control.', sideEffects: 'Low blood sugar, dizziness.', dosage: 'As prescribed, usually before breakfast.', fdaAlias: 'glimepiride' },
  { match: /vildagliptin/i, category: 'Diabetes', requiresPrescription: true, uses: 'Type 2 diabetes — blood sugar control.', sideEffects: 'Headache, mild stomach upset.', dosage: 'As prescribed.', fdaAlias: null },
  { match: /\binsulin\b/i, category: 'Diabetes', requiresPrescription: true, uses: 'Diabetes — blood sugar regulation.', sideEffects: 'Low blood sugar, injection-site reactions.', dosage: 'As prescribed by an endocrinologist.', fdaAlias: 'insulin' },

  { match: /amlodipine/i, category: 'Heart & Blood Pressure', requiresPrescription: true, uses: 'High blood pressure and chest pain (angina).', sideEffects: 'Swelling in ankles/feet, dizziness.', dosage: 'As prescribed, usually once daily.', fdaAlias: 'amlodipine' },
  { match: /losartan/i, category: 'Heart & Blood Pressure', requiresPrescription: true, uses: 'High blood pressure and kidney protection in diabetes.', sideEffects: 'Dizziness, fatigue.', dosage: 'As prescribed, usually once daily.', fdaAlias: 'losartan' },
  { match: /telmisartan/i, category: 'Heart & Blood Pressure', requiresPrescription: true, uses: 'High blood pressure.', sideEffects: 'Dizziness, back pain.', dosage: 'As prescribed, usually once daily.', fdaAlias: 'telmisartan' },
  { match: /atorvastatin/i, category: 'Heart & Blood Pressure', requiresPrescription: true, uses: 'High cholesterol management.', sideEffects: 'Muscle pain, mild digestive upset.', dosage: 'As prescribed, usually once daily at night.', fdaAlias: 'atorvastatin' },
  { match: /rosuvastatin/i, category: 'Heart & Blood Pressure', requiresPrescription: true, uses: 'High cholesterol management.', sideEffects: 'Muscle pain, headache.', dosage: 'As prescribed, usually once daily.', fdaAlias: 'rosuvastatin' },
  { match: /clopidogrel/i, category: 'Heart & Blood Pressure', requiresPrescription: true, uses: 'Prevents blood clots after heart events or stroke.', sideEffects: 'Increased bruising/bleeding risk.', dosage: 'As prescribed, usually once daily.', fdaAlias: 'clopidogrel' },

  { match: /pantoprazole/i, category: 'Gastro & Digestion', requiresPrescription: false, uses: 'Acidity, heartburn, and acid reflux.', sideEffects: 'Headache, mild stomach upset.', dosage: 'As directed, usually before breakfast.', fdaAlias: 'pantoprazole' },
  { match: /omeprazole/i, category: 'Gastro & Digestion', requiresPrescription: false, uses: 'Acidity, heartburn, and acid reflux.', sideEffects: 'Headache, mild stomach upset.', dosage: 'As directed, usually before breakfast.', fdaAlias: 'omeprazole' },
  { match: /rabeprazole/i, category: 'Gastro & Digestion', requiresPrescription: false, uses: 'Acidity, heartburn, and acid reflux.', sideEffects: 'Headache, mild nausea.', dosage: 'As directed, usually before breakfast.', fdaAlias: null },
  { match: /domperidone/i, category: 'Gastro & Digestion', requiresPrescription: false, uses: 'Nausea, vomiting, and bloating relief.', sideEffects: 'Dry mouth, mild headache.', dosage: 'As directed, before meals.', fdaAlias: 'domperidone' },
  { match: /ranitidine/i, category: 'Gastro & Digestion', requiresPrescription: false, uses: 'Acidity and heartburn relief.', sideEffects: 'Headache, mild dizziness.', dosage: 'As directed.', fdaAlias: 'ranitidine' },
  { match: /ondansetron/i, category: 'Gastro & Digestion', requiresPrescription: true, uses: 'Prevents nausea and vomiting.', sideEffects: 'Headache, constipation.', dosage: 'As prescribed.', fdaAlias: 'ondansetron' },

  { match: /ambroxol/i, category: 'Cough, Cold & Respiratory', requiresPrescription: false, uses: 'Loosens mucus in cough and chest congestion.', sideEffects: 'Mild nausea, rare allergic reaction.', dosage: 'As directed.', fdaAlias: 'ambroxol' },
  { match: /\bsalbutamol\b/i, category: 'Cough, Cold & Respiratory', requiresPrescription: false, uses: 'Relieves wheezing and breathlessness in asthma.', sideEffects: 'Tremor, fast heartbeat (mild).', dosage: 'As directed by a physician.', fdaAlias: 'albuterol' },
  { match: /levosalbutamol/i, category: 'Cough, Cold & Respiratory', requiresPrescription: false, uses: 'Relieves wheezing and breathlessness in asthma.', sideEffects: 'Mild tremor, fast heartbeat.', dosage: 'As directed by a physician.', fdaAlias: null },
  { match: /dextromethorphan/i, category: 'Cough, Cold & Respiratory', requiresPrescription: false, uses: 'Dry cough suppression.', sideEffects: 'Drowsiness, dizziness.', dosage: 'As directed.', fdaAlias: 'dextromethorphan' },

  { match: /\bthyroxine\b/i, category: 'Thyroid', requiresPrescription: true, uses: 'Underactive thyroid (hypothyroidism) management.', sideEffects: 'Rare if dosed correctly; palpitations if overdosed.', dosage: 'As prescribed, usually once daily on an empty stomach.', fdaAlias: 'levothyroxine' },

  { match: /vitamin\s*c|ascorbic acid/i, category: 'Vitamins & Supplements', requiresPrescription: false, uses: 'Immune support and vitamin C deficiency.', sideEffects: 'Mild stomach upset at high doses.', dosage: 'As directed.', fdaAlias: 'ascorbic acid' },
  { match: /vitamin\s*d3|cholecalciferol/i, category: 'Vitamins & Supplements', requiresPrescription: false, uses: 'Vitamin D deficiency and bone health support.', sideEffects: 'Rare at recommended doses.', dosage: 'As directed.', fdaAlias: 'cholecalciferol' },
  { match: /calcium/i, category: 'Vitamins & Supplements', requiresPrescription: false, uses: 'Bone health and calcium deficiency.', sideEffects: 'Constipation, mild bloating.', dosage: 'As directed, with food.', fdaAlias: 'calcium carbonate' },
  { match: /multivitamin/i, category: 'Vitamins & Supplements', requiresPrescription: false, uses: 'General nutritional supplementation.', sideEffects: 'Rare at recommended doses.', dosage: 'As directed, usually once daily.', fdaAlias: null },
  { match: /folic acid/i, category: 'Vitamins & Supplements', requiresPrescription: false, uses: 'Folate deficiency, often used in pregnancy.', sideEffects: 'Rare at recommended doses.', dosage: 'As directed.', fdaAlias: 'folic acid' },
  { match: /\biron\b|ferrous/i, category: 'Vitamins & Supplements', requiresPrescription: false, uses: 'Iron-deficiency anemia.', sideEffects: 'Constipation, dark stools.', dosage: 'As directed, ideally on an empty stomach.', fdaAlias: 'ferrous sulfate' },
  { match: /\bzinc\b/i, category: 'Vitamins & Supplements', requiresPrescription: false, uses: 'Immune support and zinc deficiency.', sideEffects: 'Mild nausea at high doses.', dosage: 'As directed.', fdaAlias: 'zinc' },

  { match: /clotrimazole/i, category: 'Skin Care', requiresPrescription: false, uses: 'Fungal skin infections.', sideEffects: 'Mild burning or irritation at application site.', dosage: 'Apply as directed, usually twice daily.', fdaAlias: 'clotrimazole' },
  { match: /mupirocin/i, category: 'Skin Care', requiresPrescription: true, uses: 'Bacterial skin infections.', sideEffects: 'Mild burning or itching at application site.', dosage: 'Apply as prescribed.', fdaAlias: 'mupirocin' },
  { match: /chlorhexidine/i, category: 'Skin Care', requiresPrescription: false, uses: 'Antiseptic for skin and oral care.', sideEffects: 'Mild irritation, taste change (oral use).', dosage: 'As directed.', fdaAlias: 'chlorhexidine' },
  { match: /povidone/i, category: 'Skin Care', requiresPrescription: false, uses: 'Antiseptic for minor cuts and wounds.', sideEffects: 'Mild skin irritation.', dosage: 'Apply as directed to affected area.', fdaAlias: 'povidone-iodine' },

  { match: /\bors\b|oral rehydration/i, category: 'First Aid & Rehydration', requiresPrescription: false, uses: 'Rehydration during diarrhea or fluid loss.', sideEffects: 'Rare when prepared as directed.', dosage: 'Dissolve in water as directed on pack.', fdaAlias: null },
];
