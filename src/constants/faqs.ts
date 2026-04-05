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
      id: 'town-hall-content',
      question: 'Does the Virtual Town Hall offer any new content?',
      answer:
        'Yes. The remaining four contestants will provide video responses to additional questions as determined by a local committee.',
    },
    {
      id: 'town-hall-weigh-in',
      question: 'How do I weigh in?',
      answer:
        'Citizens submit their ranking of the four remaining potential nominees. The top two advance to a final debate.',
    },
    {
      id: 'voting-methods',
      question: 'What voting methods will be evaluated?',
      answer:
        'Ranked Choice, STAR, Pick Two and Approval. Try all of the voting methods and weigh in using the one you like the best. This information will be collected to help determine which method will be chosen. Results will be published on our website.',
    },
  ],
  debate: [
    {
      id: 'debate-watch',
      question: 'Will I have to watch the live debate on my app?',
      answer:
        'No. The local committee will moderate and record the debate. Citizens watch it at their convenience.',
    },
    {
      id: 'debate-method',
      question: 'What method will be used to choose the candidate?',
      answer:
        'Citizens will pick one of the two remaining potential nominees. The party candidate wins the nomination with at least 50% support.',
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
