import React, { Suspense, lazy, useState } from 'react';
import { Lock } from 'lucide-react';
import { FinanceProvider, useFinance } from './store/FinanceContext';
import { Layout } from './components/Layout';
import { QuickAddModal } from './components/QuickAddModal';
import { CommandPalette } from './components/CommandPalette';
import { ToastContainer } from './components/ToastContainer';
import { ReceiptLightboxModal } from './components/ReceiptLightboxModal';
import { LanguageToggle } from './components/LanguageToggle';
import { PublicPortal } from './components/PublicPortal';
import { useI18n } from './i18n/useI18n';
import { DashboardView } from './pages/DashboardView';
import { CalculatorsFireView } from './pages/CalculatorsFireView';
import { PricingView } from './pages/PricingView';

const TransactionsView = lazy(() =>
  import('./pages/TransactionsView').then((m) => ({ default: m.TransactionsView }))
);
const ReceiptsView = lazy(() =>
  import('./pages/ReceiptsView').then((m) => ({ default: m.ReceiptsView }))
);
const BudgetsView = lazy(() =>
  import('./pages/BudgetsView').then((m) => ({ default: m.BudgetsView }))
);
const BillsView = lazy(() =>
  import('./pages/BillsView').then((m) => ({ default: m.BillsView }))
);
const AutomationView = lazy(() =>
  import('./pages/AutomationView').then((m) => ({ default: m.AutomationView }))
);
const GoalsDebtsView = lazy(() =>
  import('./pages/GoalsDebtsView').then((m) => ({ default: m.GoalsDebtsView }))
);
const AccountsView = lazy(() =>
  import('./pages/AccountsView').then((m) => ({ default: m.AccountsView }))
);
const SafetyPackView = lazy(() =>
  import('./pages/SafetyPackView').then((m) => ({ default: m.SafetyPackView }))
);
const FamilyView = lazy(() =>
  import('./pages/FamilyView').then((m) => ({ default: m.FamilyView }))
);
const ReportsView = lazy(() =>
  import('./pages/ReportsView').then((m) => ({ default: m.ReportsView }))
);
const SettingsView = lazy(() =>
  import('./pages/SettingsView').then((m) => ({ default: m.SettingsView }))
);

const ViewLoadingFallback: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="space-y-4 py-4" role="status" aria-label={t('a11y.loadingView')}>
      <div className="h-8 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
};

const PinLockScreen: React.FC = () => {
  const { state, unlockApp } = useFinance();
  const { t, entityText } = useI18n();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    const ok = await unlockApp(pin);
    setVerifying(false);
    if (!ok) {
      setErr(t('lock.incorrect'));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="fixed top-4 right-4">
        <LanguageToggle variant="pill" />
      </div>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
          {entityText(state.settings.householdName)}
        </h1>
        <p className="mt-1 text-xs text-slate-500">{t('lock.prompt')}</p>

        {err && <p className="mt-3 text-xs font-semibold text-rose-600">{err}</p>}

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setErr('');
          }}
          placeholder={t('lock.placeholder')}
          aria-label={t('lock.ariaInput')}
          className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-center text-lg font-bold tracking-widest dark:border-slate-700 dark:bg-slate-800"
          autoFocus
        />
        <button
          type="submit"
          disabled={verifying}
          className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {verifying ? t('lock.verifying') : t('lock.unlock')}
        </button>
      </form>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { authSession, activeView, isUnlocked } = useFinance();

  if (!authSession) {
    return (
      <>
        <PublicPortal />
        <ToastContainer />
      </>
    );
  }

  if (!isUnlocked) {
    return <PinLockScreen />;
  }

  return (
    <Layout>
      <Suspense fallback={<ViewLoadingFallback />}>
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'transactions' && <TransactionsView />}
        {activeView === 'receipts' && <ReceiptsView />}
        {activeView === 'budgets' && <BudgetsView />}
        {activeView === 'bills' && <BillsView />}
        {activeView === 'automation' && <AutomationView />}
        {activeView === 'goals' && <GoalsDebtsView />}
        {activeView === 'accounts' && <AccountsView />}
        {activeView === 'safety' && <SafetyPackView />}
        {activeView === 'calculators' && <CalculatorsFireView />}
        {activeView === 'family' && <FamilyView />}
        {activeView === 'reports' && <ReportsView />}
        {activeView === 'pricing' && <PricingView />}
        {activeView === 'settings' && <SettingsView />}
      </Suspense>
      <QuickAddModal />
      <CommandPalette />
      <ReceiptLightboxModal />
      <ToastContainer />
    </Layout>
  );
};

export function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}

export default App;
