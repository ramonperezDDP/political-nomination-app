import type { ContestRoundId } from '@/types';

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

// Base FAQs shown in every round
const BASE_FAQS: FAQ[] = [
  {
    id: 'alignment',
    question: 'What is the alignment score?',
    answer:
      "The alignment score shows how closely a candidate's positions match your preferences based on the questionnaire you completed. A higher score means better alignment with your values.",
  },
  {
    id: 'preferences',
    question: 'Can I change my policy preferences?',
    answer:
      'Yes! You can update your policy preferences anytime in your profile settings. Your alignment scores will automatically recalculate based on your updated preferences.',
  },
];

// Shared endorsement round FAQs (used by all three endorsement rounds)
const ENDORSEMENT_ROUND_FAQS: FAQ[] = [
  {
    id: 'how-endorsement-rounds-work',
    question: 'How do the Endorsement rounds work?',
    answer:
      'During this stage citizens are allowed to endorse all potential nominees who they want to advance to the next round. This method is called Approval Voting.',
  },
  {
    id: 'find-contestants',
    question: 'How can I find contestants to endorse?',
    answer:
      'All prospective candidates are required to state their position on seven issues for the upcoming Congressional term. Answer the quiz for issues that matter to you and find those who match or go to the For You page.',
  },
  {
    id: 'submit-endorsements',
    question: 'How do I submit my endorsements?',
    answer:
      'You can bookmark your favorite candidates and endorse them all at once, or one at a time. The app will require ID verification each time endorsements are submitted. Once transmitted, your endorsements for that round cannot be changed.',
  },
];

// Round-specific FAQs
const ROUND_FAQS: Partial<Record<ContestRoundId, FAQ[]>> = {
  round_1_endorsement: ENDORSEMENT_ROUND_FAQS,
  round_2_endorsement: ENDORSEMENT_ROUND_FAQS,
  round_3_endorsement: ENDORSEMENT_ROUND_FAQS,
  virtual_town_hall: [
    {
      id: 'ranked-choice',
      question: 'How does ranked choice voting work?',
      answer:
        'Instead of endorsing multiple candidates, you rank them in order of preference. The candidate with the fewest first-choice votes is eliminated, and their voters\' second choices are redistributed. This continues until 2 candidates remain.',
    },
    {
      id: 'town-hall-format',
      question: 'What is the Virtual Town Hall?',
      answer:
        'The Virtual Town Hall is a live event where the remaining 4 candidates present their platform and answer questions. After watching, you cast your ranked choice vote.',
    },
  ],
  debate: [
    {
      id: 'debate-format',
      question: 'How does the debate round work?',
      answer:
        'The final 2 candidates participate in a live debate. After the debate, you cast a single vote for your preferred candidate. The candidate with the majority wins the nomination.',
    },
    {
      id: 'pick-one',
      question: 'Can I only vote for one candidate?',
      answer:
        'Yes. The debate round uses pick-one voting — you select a single candidate. The candidate with more than 50% of the vote wins.',
    },
  ],
  final_results: [
    {
      id: 'results',
      question: 'Where can I see the results?',
      answer:
        "The final results are displayed on the Leaderboard tab. The winner is America's Main Street Party nominee.",
    },
    {
      id: 'audit',
      question: 'Are the results auditable?',
      answer:
        'Yes. Every round transition, vote tally, and elimination is logged in an immutable audit trail. Results can be independently verified.',
    },
  ],
};

/**
 * Returns FAQs for a given contest round: base FAQs + round-specific FAQs.
 * Falls back to round_1_endorsement FAQs for unknown round IDs.
 */
export function getFaqsForRound(roundId: ContestRoundId): FAQ[] {
  const roundSpecific = ROUND_FAQS[roundId] || ROUND_FAQS.round_1_endorsement || [];
  return [...BASE_FAQS, ...roundSpecific];
}
