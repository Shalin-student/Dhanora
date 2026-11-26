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
import { StarterTemplatesModal } from './components/StarterTemplatesModal';
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
      <div className="h-8 w-64 animate-pulse rounded-xl bg-[#eaedff] dark:bg-[#1c2640]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#eaedff] dark:bg-[#1c2640]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#eaedff] dark:bg-[#1c2640]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#eaedff] dark:bg-[#1c2640]" />
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
    <div className="bg-mesh-hero relative flex min-h-screen items-center justify-center p-4">
      <div className="fixed top-4 right-4">
        <LanguageToggle variant="pill" />
      </div>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="wdw-card-elevated w-full max-w-sm p-6 text-center sm:p-7"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#064E3B]/10 text-[#064E3B] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-[#131b2e] dark:text-[#eef0ff]">
          {entityText(state.settings.householdName)}
        </h1>
        <p className="mt-1 text-xs text-[#404944] dark:text-[#bfc9c3]">{t('lock.prompt')}</p>

        {err && <p className="mt-3 text-xs font-semibold text-[#ba1a1a]">{err}</p>}

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
          className="font-numeric mt-4 min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-4 py-2.5 text-center text-lg font-bold tracking-widest text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
          autoFocus
        />
        <button
          type="submit"
          disabled={verifying}
          className="wdw-btn-primary mt-4 min-h-[44px] w-full py-2.5 text-sm font-semibold disabled:opacity-60"
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
      <StarterTemplatesModal />
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
