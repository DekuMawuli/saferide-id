import Link from 'next/link';
import type { TrustPublicResponse } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
}

async function fetchTrust(
  code: string,
  opts?: { tier?: 'minimal' | 'standard' | 'extended'; disclosureToken?: string | null },
): Promise<{ ok: true; data: TrustPublicResponse } | { ok: false; status: number }> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return { ok: false, status: 500 };

  const qs = new URLSearchParams();
  qs.set('tier', opts?.tier ?? 'standard');
  if (opts?.disclosureToken) qs.set('disclosure_token', opts.disclosureToken);

  const res = await fetch(`${apiBase}/public/trust/${encodeURIComponent(code)}?${qs}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as TrustPublicResponse };
}

export default async function VerifyBasicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ disclosure_token?: string }>;
}) {
  const { id } = await params;
  const { disclosure_token } = await searchParams;
  const code = id.trim();
  const disclosureToken = disclosure_token?.trim() || null;

  let trust: TrustPublicResponse | null = null;
  let notice: string | null = null;

  if (disclosureToken) {
    const extended = await fetchTrust(code, { tier: 'extended', disclosureToken });
    if (extended.ok) {
      trust = extended.data;
    } else if (extended.status === 403) {
      notice = 'Full details are no longer available. Showing the basic profile instead.';
    }
  }

  if (!trust) {
    const minimal = await fetchTrust(code, { tier: 'standard' });
    if (minimal.ok) {
      trust = minimal.data;
    } else if (minimal.status === 404) {
      return (
        <main className="mx-auto min-h-screen max-w-xl px-4 py-10 text-slate-900">
          <h1 className="text-2xl font-bold">SafeRide basic lookup</h1>
          <p className="mt-4 text-sm">No driver record was found for code {code.toUpperCase()}.</p>
          <p className="mt-6">
            <Link href="/verify" className="text-indigo-700 underline">
              Try another code
            </Link>
          </p>
        </main>
      );
    } else {
      return (
        <main className="mx-auto min-h-screen max-w-xl px-4 py-10 text-slate-900">
          <h1 className="text-2xl font-bold">SafeRide basic lookup</h1>
          <p className="mt-4 text-sm">
            The verification service is unavailable right now. Please try again later.
          </p>
        </main>
      );
    }
  }

  const fullHref = disclosureToken
    ? `/verify/result/${encodeURIComponent(code)}?disclosure_token=${encodeURIComponent(disclosureToken)}`
    : `/verify/result/${encodeURIComponent(code)}`;

  const band = (trust.trust_band || '').toUpperCase();
  const bandLabel =
    band === 'CLEAR' ? '✓ CLEAR — safe to board' :
    band === 'BLOCK' ? '✗ BLOCK — do not board' :
    band === 'CAUTION' ? '! CAUTION — proceed carefully' :
    band || 'Unknown';

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-white px-4 py-8 text-slate-900">
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SafeRide driver check</p>
        <h1 className="mt-2 text-2xl font-bold">{trust.display_name || 'Verified driver'}</h1>
        <p className="mt-1 text-sm text-slate-600">Code: {code.toUpperCase()}</p>
      </div>

      {notice ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {notice}
        </div>
      ) : null}

      <section className="mt-4 rounded-lg border border-slate-200 p-4">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-slate-700">Trust</dt>
            <dd className={band === 'CLEAR' ? 'font-bold text-green-700' : band === 'BLOCK' ? 'font-bold text-red-700' : 'font-bold text-amber-700'}>
              {bandLabel}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Status</dt>
            <dd>{trust.status}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Vehicle(s)</dt>
            <dd>
              {trust.vehicles.length
                ? trust.vehicles.map((vehicle) => vehicle.plate || vehicle.display_name || 'Unknown').join(', ')
                : 'No vehicle on file'}
            </dd>
          </div>
          {trust.phone ? (
            <div>
              <dt className="font-semibold text-slate-700">Phone (consented)</dt>
              <dd>{trust.phone}</dd>
            </div>
          ) : null}
          {trust.esignet_verified_at ? (
            <div>
              <dt className="font-semibold text-slate-700">ID verified</dt>
              <dd>{trust.esignet_verified_at}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
        <p>This page works on basic browsers. No JavaScript required.</p>
        <p className="mt-2">
          <Link href={fullHref} className="text-indigo-700 underline">
            Open full verification page
          </Link>
        </p>
      </section>
    </main>
  );
}
