/**
 * Terms of Service and Privacy Policy, shown in the app (src/app/legal/[doc].tsx)
 * so users can read them before agreeing.
 *
 * TODO: replace with Zeno's published text and set `draft: false`. While
 * `draft` is true the reader shows a "Draft" notice above the text.
 */

export type LegalDocId = 'terms' | 'privacy';

export type LegalDocument = {
  title: string;
  /** One line for the list on the terms screen. */
  summary: string;
  updated: string;
  draft: boolean;
  sections: { heading: string; body: string[] }[];
};

const PENDING = "Zeno's published text for this section will appear here.";

export const LEGAL: Record<LegalDocId, LegalDocument> = {
  terms: {
    title: 'Terms of Service',
    summary: 'How Zeno works and what you agree to',
    updated: 'Draft',
    draft: true,
    sections: [
      {
        heading: 'About Zeno',
        body: [
          'Zeno is portfolio infrastructure software for buying and redeeming baskets of tokenized assets on Robinhood Chain.',
          'Nothing in the app is investment, tax or legal advice.',
        ],
      },
      {
        heading: 'Risks',
        body: [
          'Tokenized equities and other tokenized assets carry risk, including total loss of the amount invested. Past performance does not predict future results.',
        ],
      },
      {
        heading: 'Your wallet',
        body: [
          'You control your wallet and its keys. Zeno never holds your keys and cannot reverse a transaction once it is confirmed on chain.',
        ],
      },
      { heading: 'Eligibility', body: [PENDING] },
      { heading: 'Fees', body: [PENDING] },
      { heading: 'Liability', body: [PENDING] },
      { heading: 'Changes to these terms', body: [PENDING] },
      { heading: 'Contact', body: [PENDING] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'What we collect and how it is used',
    updated: 'Draft',
    draft: true,
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Your wallet address, your name and country from your profile, and the email address if you sign in with email.',
          'Identity verification is handled by our provider, Didit; Zeno receives the result of the check.',
        ],
      },
      { heading: 'How we use it', body: [PENDING] },
      { heading: 'Sharing', body: [PENDING] },
      { heading: 'Retention', body: [PENDING] },
      { heading: 'Your rights', body: [PENDING] },
      { heading: 'Contact', body: [PENDING] },
    ],
  },
};

export function isLegalDocId(value: unknown): value is LegalDocId {
  return value === 'terms' || value === 'privacy';
}
