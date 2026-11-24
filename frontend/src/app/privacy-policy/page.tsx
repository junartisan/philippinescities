import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Philippines Cities, describing how personal information is collected, used, and protected in accordance with Philippine law.",
};

const EFFECTIVE_DATE = "November 24, 2026";

const sections = [
  {
    title: "1. Information We Collect",
    body: [
      "We collect information you provide directly when you create an account, submit a business listing, claim a listing, post reviews or comments, apply as a contributor, upload images, or contact us. This may include your name, email address, phone number, profile image, business details, and content you submit.",
      "We also collect information automatically when you use the website, such as IP address, browser and device information, pages visited, referring URLs, and usage timestamps. If you sign in with Google or Facebook, we receive basic profile information authorized by you, such as your name, email address, and profile picture.",
    ],
  },
  {
    title: "2. How We Use Information",
    body: [
      "We use personal information to operate and improve Philippines Cities, create and manage accounts, verify email addresses, process business listings, claims, reviews, contributor applications, and featured listing requests, communicate with you, prevent abuse and fraud, and comply with legal obligations.",
      "We may use aggregated or de-identified information for analytics and service improvement. We do not sell your personal information.",
    ],
  },
  {
    title: "3. Sharing of Information",
    body: [
      "Business listing information you submit for publication, such as business name, description, address, contact details, website, images, and updates, may be displayed publicly on the website.",
      "We may share information with service providers who help us operate the website, such as hosting, email delivery, authentication, payment processing, and analytics providers. We may also disclose information when required by law, legal process, or to protect the rights, safety, and security of Philippines Cities, our users, or the public.",
    ],
  },
  {
    title: "4. Cookies and Similar Technologies",
    body: [
      "We use cookies, local storage, and similar technologies to keep you signed in, remember preferences, maintain security, and understand how the website is used. You can control cookies through your browser settings, but some features may not function properly if cookies are disabled.",
    ],
  },
  {
    title: "5. Data Retention and Security",
    body: [
      "We retain personal information only for as long as necessary for the purposes described in this policy, unless a longer retention period is required or permitted by law. We implement reasonable organizational, physical, and technical safeguards to protect personal information, but no method of transmission or storage is completely secure.",
    ],
  },
  {
    title: "6. Your Rights Under Philippine Law",
    body: [
      "Subject to applicable law, including the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules, you may have the right to be informed, to access, to object, to erasure or blocking, to correct, to data portability where applicable, to file a complaint, and to damages for violations of your data privacy rights.",
      "To exercise your rights, please contact us using the details below. We may need to verify your identity before processing your request. You may also lodge a complaint with the National Privacy Commission (NPC) of the Philippines if you believe your data privacy rights have been violated.",
    ],
  },
  {
    title: "7. Third-Party Links and Services",
    body: [
      "Our website may contain links to third-party websites or services, including business websites, social media pages, maps, and payment providers. We are not responsible for the privacy practices of those third parties. Please review their privacy policies before providing personal information.",
    ],
  },
  {
    title: "8. Children’s Privacy",
    body: [
      "Philippines Cities is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information to us, please contact us so we can take appropriate action.",
    ],
  },
  {
    title: "9. Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time. When we do, we will update the effective date on this page. Your continued use of the website after changes take effect means you acknowledge the updated policy.",
    ],
  },
  {
    title: "10. Contact Us",
    body: [
      "For privacy-related questions or requests, contact the Philippines Cities administrator through the official contact channels published on the website. If you need to exercise your data privacy rights, please include enough detail for us to identify you and understand your request.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          This Privacy Policy explains how Philippines Cities collects, uses,
          shares, and protects personal information when you use our website and
          services.
        </p>
        <p className="mt-3 text-sm text-slate-500">Effective date: {EFFECTIVE_DATE}</p>
      </div>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 text-sm leading-7 text-slate-700">
        <p>
          Looking for general information about the directory? Visit our{" "}
          <Link href="/businesses" className="font-semibold text-emerald-700 hover:text-emerald-800">
            business listings
          </Link>{" "}
          or{" "}
          <Link href="/register" className="font-semibold text-emerald-700 hover:text-emerald-800">
            create an account
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
