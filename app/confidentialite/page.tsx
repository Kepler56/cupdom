import type { Metadata } from 'next';
import { RETENTION_COPY_FR, RETENTION_MONTHS } from '@/lib/gdpr/retention';

// PUBLIC privacy policy (Spec 3B, AC-19) — no auth, reachable from the lead form's consent link
// (PRIVACY_POLICY_HREF = '/confidentialite') and the footer. Static French copy; the retention
// figure comes from RETENTION_MONTHS (single source). CONTENT IS A PLACEHOLDER pending DPO/counsel
// sign-off. No user/dynamic input is rendered here; any future variable insertion MUST go through
// escapeHtml per house rules.
export const metadata: Metadata = {
  title: 'Politique de confidentialité — Cupdom',
  description: 'Comment Cupdom et ses sponsors traitent vos données de lead.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-canvas px-4 py-8 sm:px-5 sm:py-10">
      <h1 className="mb-2 text-2xl font-semibold text-text">Politique de confidentialité</h1>
      <p className="mb-8 text-sm italic text-text-faint">
        Politique provisoire, en attente de validation par le DPO.
      </p>

      <div className="space-y-8">
        <Section title="Responsables du traitement">
          <p>
            Cupdom <strong>et le sponsor nommé</strong> de la campagne que vous avez scannée sont
            <strong> responsables conjoints</strong> du traitement de vos données. Un accord de partage de
            données encadre la copie détenue par le sponsor.
          </p>
        </Section>

        <Section title="Finalités">
          <p>
            Vos données servent à vous transmettre l&apos;offre du sponsor, à prouver la valeur du placement
            publicitaire et, à l&apos;avenir, à entraîner des modèles d&apos;analyse. La base légale est votre
            <strong> consentement explicite</strong>, recueilli sur le formulaire.
          </p>
        </Section>

        <Section title="Destinataires">
          <p>
            Vos données sont communiquées à Cupdom et au <strong>sponsor nommé</strong> de la campagne scannée,
            dans le cadre de la génération de prospects (lead-gen). Elles ne sont pas vendues à des tiers.
          </p>
        </Section>

        <Section title="Durée de conservation">
          <p>{RETENTION_COPY_FR}</p>
          <p>
            Au-delà de {RETENTION_MONTHS} mois d&apos;inactivité, vos données personnelles (prénom, nom, email,
            téléphone) sont <strong>supprimées</strong> ; seules les statistiques anonymes (entonnoir) sont
            conservées.
          </p>
        </Section>

        <Section title="Vos droits">
          <p>
            Vous disposez d&apos;un droit d&apos;<strong>accès</strong>, de <strong>rectification</strong>,
            d&apos;<strong>effacement</strong> et de <strong>retrait du consentement</strong> — aussi simple à
            retirer qu&apos;à donner. Ces droits s&apos;exercent via le contact ci-dessous.
          </p>
        </Section>

        <Section title="Nous contacter">
          <p>
            Pour exercer vos droits ou demander l&apos;effacement de vos données, écrivez à{' '}
            <a href="mailto:confidentialite@cupdom.fr" className="text-primary underline">
              confidentialite@cupdom.fr
            </a>
            . Toute demande d&apos;effacement ou de retrait du consentement est traitée rapidement ; Cupdom en
            informe le sponsor concerné lorsque cela est possible.
          </p>
        </Section>
      </div>
    </main>
  );
}
