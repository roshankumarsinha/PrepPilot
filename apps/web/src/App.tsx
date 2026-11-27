import { HealthCard } from './components/HealthCard';

export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <h1 className="text-lg font-semibold">PrepPilot</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              AI co-pilot for interview prep
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <HealthCard />
      </main>
    </div>
  );
}
