// Run this script with: node scripts/seedIssues.js
// Make sure you have firebase-admin installed and a service account key

const admin = require('firebase-admin');

// Initialize with your project
admin.initializeApp({
  projectId: 'party-nomination-app',
});

const db = admin.firestore();

const issues = [
  // Economy & Jobs
  {
    id: 'economy',
    name: 'Economy & Jobs',
    description: 'Economic policy, job creation, and workforce development',
    category: 'Economy',
    icon: 'currency-usd',
    order: 1,
    isActive: true,
  },
  {
    id: 'taxes',
    name: 'Tax Policy',
    description: 'Federal tax rates, tax reform, and fiscal policy',
    category: 'Economy',
    icon: 'file-document',
    order: 2,
    isActive: true,
  },
  {
    id: 'minimum-wage',
    name: 'Minimum Wage',
    description: 'Federal and state minimum wage policies',
    category: 'Economy',
    icon: 'cash',
    order: 3,
    isActive: true,
  },

  // Healthcare
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Healthcare access, affordability, and reform',
    category: 'Healthcare',
    icon: 'hospital',
    order: 4,
    isActive: true,
  },
  {
    id: 'medicare',
    name: 'Medicare & Medicaid',
    description: 'Government healthcare programs for seniors and low-income',
    category: 'Healthcare',
    icon: 'medical-bag',
    order: 5,
    isActive: true,
  },
  {
    id: 'prescription-drugs',
    name: 'Prescription Drug Prices',
    description: 'Regulation and pricing of pharmaceutical drugs',
    category: 'Healthcare',
    icon: 'pill',
    order: 6,
    isActive: true,
  },

  // Education
  {
    id: 'education',
    name: 'Education',
    description: 'K-12 education policy and school funding',
    category: 'Education',
    icon: 'school',
    order: 7,
    isActive: true,
  },
  {
    id: 'higher-education',
    name: 'Higher Education',
    description: 'College affordability and student loan policy',
    category: 'Education',
    icon: 'account-school',
    order: 8,
    isActive: true,
  },

  // Environment
  {
    id: 'climate-change',
    name: 'Climate Change',
    description: 'Climate policy and environmental protection',
    category: 'Environment',
    icon: 'earth',
    order: 9,
    isActive: true,
  },
  {
    id: 'clean-energy',
    name: 'Clean Energy',
    description: 'Renewable energy and reducing fossil fuel dependence',
    category: 'Environment',
    icon: 'solar-power',
    order: 10,
    isActive: true,
  },

  // Immigration
  {
    id: 'immigration',
    name: 'Immigration',
    description: 'Immigration policy and border security',
    category: 'Immigration',
    icon: 'passport',
    order: 11,
    isActive: true,
  },
  {
    id: 'path-to-citizenship',
    name: 'Path to Citizenship',
    description: 'Policies for undocumented immigrants',
    category: 'Immigration',
    icon: 'card-account-details',
    order: 12,
    isActive: true,
  },

  // Civil Rights
  {
    id: 'civil-rights',
    name: 'Civil Rights',
    description: 'Equal rights and anti-discrimination policies',
    category: 'Civil Rights',
    icon: 'scale-balance',
    order: 13,
    isActive: true,
  },
  {
    id: 'voting-rights',
    name: 'Voting Rights',
    description: 'Election access and voting protections',
    category: 'Civil Rights',
    icon: 'vote',
    order: 14,
    isActive: true,
  },
  {
    id: 'criminal-justice',
    name: 'Criminal Justice Reform',
    description: 'Police reform, sentencing, and prison policy',
    category: 'Civil Rights',
    icon: 'gavel',
    order: 15,
    isActive: true,
  },

  // Foreign Policy
  {
    id: 'foreign-policy',
    name: 'Foreign Policy',
    description: 'International relations and diplomacy',
    category: 'Foreign Policy',
    icon: 'earth',
    order: 16,
    isActive: true,
  },
  {
    id: 'defense',
    name: 'National Defense',
    description: 'Military spending and national security',
    category: 'Foreign Policy',
    icon: 'shield',
    order: 17,
    isActive: true,
  },

  // Social Issues
  {
    id: 'gun-policy',
    name: 'Gun Policy',
    description: 'Second Amendment rights and gun safety regulations',
    category: 'Social Issues',
    icon: 'pistol',
    order: 18,
    isActive: true,
  },
  {
    id: 'abortion',
    name: 'Reproductive Rights',
    description: 'Abortion access and reproductive healthcare',
    category: 'Social Issues',
    icon: 'human-pregnant',
    order: 19,
    isActive: true,
  },
  {
    id: 'lgbtq-rights',
    name: 'LGBTQ+ Rights',
    description: 'Equal rights and protections for LGBTQ+ individuals',
    category: 'Social Issues',
    icon: 'rainbow',
    order: 20,
    isActive: true,
  },

  // Infrastructure
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'Roads, bridges, and public works investment',
    category: 'Infrastructure',
    icon: 'bridge',
    order: 21,
    isActive: true,
  },
  {
    id: 'housing',
    name: 'Housing',
    description: 'Affordable housing and homelessness',
    category: 'Infrastructure',
    icon: 'home',
    order: 22,
    isActive: true,
  },
];

async function seedIssues() {
  console.log('Seeding issues...');

  const batch = db.batch();

  for (const issue of issues) {
    const docRef = db.collection('issues').doc(issue.id);
    batch.set(docRef, issue);
  }

  await batch.commit();
  console.log(`Successfully seeded ${issues.length} issues!`);
  process.exit(0);
}

seedIssues().catch((error) => {
  console.error('Error seeding issues:', error);
  process.exit(1);
});
