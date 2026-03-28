import type { ContestRoundId } from '@/types';

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

// Base FAQs shown in every round
const BASE_FAQS: FAQ[] = [
  {
    id: 'endorsement',
    question: 'How do endorsements work?',
    answer:
      'Endorsements are your way of showing support for candidates. You can endorse multiple candidates, and your endorsements help determine who advances in the nomination process. Endorsements are anonymous to candidates.',
  },
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

// Round-specific FAQs
const ROUND_FAQS: Partial<Record<ContestRoundId, FAQ[]>> = {
  pre_nomination: [
    {
      id: 'when-voting',
      question: 'When can I vote?',
      answer:
        "Voting opens after the endorsement phase ends. You'll be notified when voting begins. Only candidates who meet the endorsement threshold will appear on the ballot.",
    },
  ],
  round_1_endorsement: [
    {
      id: 'how-many-advance-r1',
      question: 'How many candidates advance from Round 1?',
      answer:
        'The top 20 candidates by endorsement count will advance to Round 2. You can endorse as many candidates as you like — this is approval voting.',
    },
    {
      id: 'what-happens-endorsements',
      question: 'What happens to my endorsements after this round?',
      answer:
        'Each round starts fresh. In the next round, you will endorse again from the remaining candidates. This ensures each round reflects current voter preferences.',
    },
  ],
  round_2_endorsement: [
    {
      id: 'how-many-advance-r2',
      question: 'How many candidates advance from Round 2?',
      answer:
        'The top 10 candidates by endorsement count will advance to Round 3. If candidates are tied at the cutoff, the tie is broken by trending score.',
    },
  ],
  round_3_endorsement: [
    {
      id: 'how-many-advance-r3',
      question: 'How many candidates advance from Round 3?',
      answer:
        'The top 4 candidates will advance to the Virtual Town Hall, where the voting method changes to ranked choice.',
    },
  ],
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
 * Falls back to pre_nomination FAQs for unknown round IDs.
 */
export function getFaqsForRound(roundId: ContestRoundId): FAQ[] {
  const roundSpecific = ROUND_FAQS[roundId] || ROUND_FAQS.pre_nomination || [];
  return [...BASE_FAQS, ...roundSpecific];
}
