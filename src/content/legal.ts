/**
 * Terms of Service and Privacy Policy, shown in the app (src/app/legal/[doc].tsx)
 * so users can read them before agreeing.
 *
 * Copied word for word from the web app (programmable-dtf-infra,
 * apps/dtf-app/app/docs/terms/page.tsx and privacy/page.tsx). Keep the two in
 * sync: change the text there first, then here.
 */

export type LegalDocId = 'terms' | 'privacy';

/** Intro text; a `{ doc, label }` part links to the other document. */
export type LegalIntroPart = string | { doc: LegalDocId; label: string };

export type LegalDocument = {
  title: string;
  /** One line for the list on the terms screen. */
  summary: string;
  /** The line under the title (web: `copy`). */
  copy: string;
  /** Shown as "Last updated <date>". */
  updated: string;
  intro: LegalIntroPart[];
  sections: { heading: string; body: string }[];
};

export const LEGAL: Record<LegalDocId, LegalDocument> = {
  terms: {
    title: 'Terms of Service',
    summary: 'The rules for using the platform',
    copy: 'The rules that govern access to and use of the CyreneAI DTF platform. Please read them carefully.',
    updated: '12 Oct 2026',
    intro: [
      'These Terms of Service set out the legal agreement between you and CyreneAI for using the Platform. By using the Platform, you agree to these Terms, our ',
      { doc: 'privacy', label: 'Privacy Policy' },
      ', and any other policies linked here.',
    ],
    sections: [
      {
        heading: '1. Acceptance of these Terms',
        body: 'By accessing, browsing, or using the CyreneAI website, interface, or related tools (collectively, the "Platform"), you agree to be bound by these Terms of Service and the documents incorporated by reference, including our Privacy Policy. If you do not agree, you must stop using the Platform immediately. Your continued use after we post changes constitutes your acceptance of the revised terms.',
      },
      {
        heading: '2. Eligibility and prohibited jurisdictions',
        body: 'You must be at least the age of majority in your jurisdiction, have the legal capacity to enter into a binding contract, and be authorized to use the linked wallet and account you connect to the Platform. You may not use the Platform if you are located in, or are a resident or national of, any jurisdiction where access is prohibited by applicable law, or if you appear on any applicable sanctions, restricted-party, or denied-persons list. Access to permissioned DTFs also depends on satisfying the eligibility, allowlist, and identity-verification requirements set by the DTF creator.',
      },
      {
        heading: '3. Accounts, wallets and security',
        body: 'CyreneAI uses an account-based session for product features; the wallet you link is used to sign on-chain drafts and transactions. You are solely responsible for safeguarding your wallet seed phrase, private keys, account credentials, and any devices used to access the Platform. CyreneAI does not hold, custody, or control your wallet, private keys, or on-chain assets. We cannot recover lost wallets, reverse blockchain transactions, or restore access to lost credentials. You must notify us promptly through the contact channels if you suspect unauthorized use of your account.',
      },
      {
        heading: '4. DTF, tokenized-asset and protocol risks',
        body: 'Decentralized Tokenized Funds ("DTFs") and other tokenized assets carry significant risk, including the possibility of total loss of the amount invested. Tokenized assets may be volatile, illiquid, transfer-restricted, or subject to eligibility and allowlist conditions. On-chain transactions are irreversible once confirmed. Smart contracts, oracles, liquidity venues, bridge or interoperability infrastructure, and rebalancing execution may fail, behave unexpectedly, or be exploited. DTF management fees, expense ratios, and other terms are set by the DTF creator and disclosed before investment. Nothing on the Platform is investment, tax, or legal advice, and no DTF, creator, or token is endorsed by CyreneAI.',
      },
      {
        heading: '5. Prohibited use',
        body: 'You may not use the Platform for any unlawful, fraudulent, or abusive purpose. Specifically, you must not: (a) violate any applicable law, regulation, or sanctions program; (b) engage in money laundering, terrorist financing, market manipulation, or sanctions evasion; (c) provide false, misleading, or incomplete identity or eligibility information; (d) reverse engineer, decompile, or attempt to derive source code or trade secrets; (e) scrape, crawl, or use automated means to access the Platform in excess of normal browsing; (f) interfere with, disrupt, or overload the Platform or connected networks; (g) infringe intellectual property rights; or (h) assist or encourage another person to do any of the above.',
      },
      {
        heading: '6. Intellectual property',
        body: 'All text, graphics, logos, marks, software, and other content made available by CyreneAI on the Platform are owned by or licensed to CyreneAI and are protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Platform for its intended purpose. You may not copy, modify, distribute, create derivative works of, publicly display, or otherwise exploit any part of the Platform without our prior written consent. DTF names, symbols, and related creator content remain the property of their respective owners.',
      },
      {
        heading: '7. Disclaimers',
        body: 'The Platform and all content, tools, and services are provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. CyreneAI does not warrant that the Platform will be uninterrupted, error-free, secure, free of viruses, or compatible with all devices or networks. CyreneAI is not a broker-dealer, investment adviser, bank, custodian, or money transmitter. Any information, prices, allocations, NAVs, or performance metrics displayed is illustrative or derived from third-party or on-chain sources and should not be relied upon as investment advice.',
      },
      {
        heading: '8. Limitation of liability',
        body: 'To the maximum extent permitted by applicable law, CyreneAI and its affiliates, officers, directors, employees, and contractors will not be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages, including lost profits, lost data, or loss of goodwill, arising out of or in connection with your use of the Platform. Our total aggregate liability for any claim related to the Platform will not exceed the greater of (a) the amount you paid to CyreneAI in fees for use of the Platform in the twelve months preceding the claim, or (b) one hundred United States dollars (USD 100.00). Some jurisdictions do not allow the exclusion or limitation of certain damages, so this limitation may not apply to you to the extent prohibited by law.',
      },
      {
        heading: '9. Dispute resolution, arbitration and governing law',
        body: 'Any dispute, claim, or controversy arising out of or relating to these Terms or the Platform will be resolved exclusively through binding arbitration administered in [DESIGNATED JURISDICTION] in accordance with [ARBITRATION RULES], except that either party may seek injunctive or other equitable relief in a court of competent jurisdiction for intellectual property or confidentiality matters. You and CyreneAI waive any right to participate in class actions, class-wide arbitration, private attorney general actions, or representative proceedings. These Terms are governed by the laws of [GOVERNING JURISDICTION], without regard to conflict-of-laws principles. This section is a placeholder for counsel review before launch.',
      },
      {
        heading: '10. Changes to these Terms',
        body: 'We may revise these Terms at any time by posting an updated version on the Platform. Material changes will be brought to your attention through a notice on the Platform or by email where we have your contact details. If you continue to use the Platform after changes become effective, you accept the revised Terms. If you do not agree to the revised Terms, you must stop using the Platform.',
      },
      {
        heading: '11. Contact',
        body: 'If you have questions about these Terms, please reach out through the Contact page or the support channels listed there.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'How your information is collected and used',
    copy: 'How CyreneAI collects, uses, stores, and protects your information',
    updated: '12 Oct 2026',
    intro: [
      'This Privacy Policy describes our practices for the CyreneAI platform. It is a template for legal review and should be finalized with counsel before launch. For the legal terms of use, see our ',
      { doc: 'terms', label: 'Terms of Service' },
      '.',
    ],
    sections: [
      {
        heading: '1. Data we collect',
        body: 'We collect information needed to provide the Platform and meet access requirements: account and profile information (such as email address, name, and chosen identifiers); identity-verification and eligibility information where required for a specific DTF or permissioned feature; wallet addresses and other public blockchain identifiers that you connect or share with us; device, browser, and usage data (such as IP address, browser type, operating system, session duration, and pages visited); information from your communications and support requests; and on-chain transaction and smart-contract interaction data associated with connected wallet addresses.',
      },
      {
        heading: '2. How we use your data',
        body: 'We use the data we collect to operate, maintain, and improve the Platform; authenticate your account and wallet link; prepare and display wallet-signed transaction drafts, portfolio positions, and DTF information; communicate with you about your account, transactions, and service updates; detect, prevent, and address fraud, abuse, security risks, and technical issues; comply with applicable legal and regulatory obligations, including sanctions, anti-fraud, and know-your-customer requirements; and understand how the Platform is used so we can prioritize improvements.',
      },
      {
        heading: '3. Wallet and on-chain data',
        body: 'CyreneAI does not have access to your wallet private keys, seed phrase, or signing credentials. When you connect a wallet, we read the public wallet address and related public blockchain data, such as token balances, transaction history, and smart-contract interactions, to display information and prepare transaction drafts. Blockchain data is public, immutable, and not controlled by CyreneAI. We cannot delete, modify, or reverse information that is recorded on a blockchain.',
      },
      {
        heading: '4. Cookies and similar technologies',
        body: 'We and our service providers may use cookies, pixels, local storage, and other tracking technologies to enable essential functionality, remember your preferences, understand how the Platform is used, and improve performance and security. You can manage cookies through your browser or device settings. Restricting cookies may affect some features of the Platform.',
      },
      {
        heading: '5. Third parties and service providers',
        body: 'We may share information with service providers who help us operate the Platform, such as hosting, analytics, identity verification, customer support, and blockchain infrastructure providers. We may also disclose information to law enforcement, regulators, or other authorities when required by law or to protect our rights; to our affiliates as part of ordinary business operations; with your consent; or in connection with a corporate transaction such as a merger or acquisition. We do not sell your personal information to third parties for their own marketing purposes.',
      },
      {
        heading: '6. Security',
        body: 'We implement reasonable administrative, technical, and physical safeguards designed to protect the information we hold. No method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials, wallet seed phrase, and private keys. If you believe your account or wallet has been compromised, contact us immediately.',
      },
      {
        heading: '7. Data retention',
        body: 'We retain information for as long as necessary to provide the Platform, fulfill the purposes described in this Policy, comply with legal and regulatory obligations, resolve disputes, and enforce our agreements. On-chain data is retained on the public blockchain indefinitely and is not under our control. Where we are able to delete personal data from our systems, we will do so in accordance with applicable law and our record-retention schedules.',
      },
      {
        heading: '8. Your rights and choices',
        body: 'Depending on your jurisdiction, you may have the right to access, correct, delete, restrict, or object to the processing of your personal data, or to receive a portable copy of your data. You may also have the right to withdraw consent where processing is based on consent. These rights are not absolute and may be limited by applicable law or technical constraints (for example, we cannot delete on-chain data). To exercise your rights, contact us through the details below. We may need to verify your identity before responding.',
      },
      {
        heading: '9. Children',
        body: 'The Platform is not directed to children under the age of 13, or the equivalent age of majority in your jurisdiction, and we do not knowingly collect personal information from children. If you believe we have collected personal information from a child, please contact us and we will take steps to delete that information where required by law.',
      },
      {
        heading: '10. Changes to this Policy',
        body: 'We may update this Privacy Policy from time to time. Material changes will be communicated through the Platform or by email where we have your contact details. The "Last updated" date at the top of this page reflects the most recent revision. Your continued use of the Platform after changes become effective means you accept the revised Policy.',
      },
      {
        heading: '11. Contact',
        body: 'If you have questions, concerns, or requests about this Privacy Policy or our data practices, please reach out through the Contact page or the support channels listed there.',
      },
    ],
  },
};

export function isLegalDocId(value: unknown): value is LegalDocId {
  return value === 'terms' || value === 'privacy';
}
