import type { HealthResponse } from '@preppilot/shared';
import { useHealth } from '../api/useHealth';
import { formatDuration } from '../lib/format';

type Tone = 'good' | 'bad' | 'neutral';

const TONE_DOT: Record<Tone, string> = {
  good: 'bg-emerald-500',
  bad: 'bg-rose-500',
  neutral: 'bg-slate-400 animate-pulse',
};

export function HealthCard() {
  const { data, error, isPending, isFetching, refetch } = useHealth();

  return (
    <section
      aria-labelledby="health-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="health-heading" className="text-base font-semibold">
            System health
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Live result of <code className="font-mono text-xs">GET /health</code>, refreshed every
            10 seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {isFetching ? 'Checking…' : 'Check again'}
        </button>
      </div>

      <div className="mt-6" aria-live="polite">
        {isPending ? (
          <StatusRow label="API" tone="neutral" value="Checking…" />
        ) : error ? (
          <StatusRow label="API" tone="bad" value="Unreachable" detail={error.message} />
        ) : (
          <HealthDetails health={data} />
        )}
      </div>
    </section>
  );
}

function HealthDetails({ health }: { health: HealthResponse }) {
  const dbUp = health.db.status === 'up';
  return (
    <>
      <p className="mb-4 text-2xl font-semibold" data-testid="overall-status">
        {health.status === 'ok' ? 'All systems operational' : 'Degraded'}
      </p>
      <dl className="divide-y divide-slate-200 dark:divide-slate-800">
        <StatusRow label="API" tone="good" value="Up" />
        <StatusRow
          label="Database"
          tone={dbUp ? 'good' : 'bad'}
          value={dbUp ? `Up · ${health.db.latencyMs} ms` : 'Down'}
          detail={health.db.error}
        />
        <StatusRow label="API uptime" value={formatDuration(health.uptimeSeconds)} />
        <StatusRow label="Checked at" value={new Date(health.timestamp).toLocaleTimeString()} />
      </dl>
    </>
  );
}

interface StatusRowProps {
  label: string;
  value: string;
  tone?: Tone;
  detail?: string;
}

function StatusRow({ label, value, tone, detail }: StatusRowProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="flex items-center gap-2 font-medium">
        {tone && <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} />}
        {value}
      </dd>
      {detail && (
        <dd className="w-full font-mono text-xs break-words text-rose-600 dark:text-rose-400">
          {detail}
        </dd>
      )}
    </div>
  );
}
