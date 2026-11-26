import React, { useMemo, useState } from 'react';
import { Calculator, Flame, Home, Scale, Sparkles } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { formatMoney } from '../utils/currency';
import { computePortfolioSummary } from '../utils/portfolio';
import {
  compareIndianTaxRegimes,
  comparePrepayVsInvest,
  compareRentVsBuy,
  formatIndianScaleHint,
  simulateFirePlan,
} from '../utils/planners';
import { useI18n } from '../i18n/useI18n';

export type CalculatorTab = 'fire' | 'tax' | 'rent-buy' | 'prepay';

export const CalculatorsFireView: React.FC<{
  initialTab?: CalculatorTab;
  embedded?: boolean;
}> = ({ initialTab = 'fire', embedded = false }) => {
  const { state } = useFinance();
  const { language, t } = useI18n();
  const currency = embedded ? 'INR' : state.settings.baseCurrency;
  const privacy = embedded ? false : state.settings.privacyMode;
  const portfolio = useMemo(() => computePortfolioSummary(state), [state]);

  const [tab, setTab] = useState<CalculatorTab>(initialTab);

  // 1. FIRE State
  const [curAge, setCurAge] = useState(34);
  const [retireAge, setRetireAge] = useState(50);
  const [monthlySpend, setMonthlySpend] = useState(65000);
  const [monthlySave, setMonthlySave] = useState(70000);
  const [curCorpus, setCurCorpus] = useState(
    embedded ? 2800000 : Math.max(50000, Math.round(portfolio.totalCurrentValue))
  );
  const [fireReturn, setFireReturn] = useState(11);
  const [fireInflation, setFireInflation] = useState(6);
  const [postRetTax, setPostRetTax] = useState(12.5);

  const fireResult = useMemo(
    () =>
      simulateFirePlan({
        currentAge: curAge,
        retireAge,
        lifeExpectancy: 90,
        currentCorpus: curCorpus,
        monthlyInvestment: monthlySave,
        monthlyRetirementExpenseToday: monthlySpend,
        inflationPct: fireInflation,
        preRetireReturnPct: fireReturn,
        postRetireReturnPct: Math.max(5.5, fireReturn - 3),
        postRetireTaxPct: postRetTax,
      }),
    [curAge, retireAge, curCorpus, monthlySave, monthlySpend, fireInflation, fireReturn, postRetTax]
  );

  // 2. Old vs New Tax Regime State (FY 2026-27 INR)
  const [grossIncome, setGrossIncome] = useState(1800000);
  const [ded80C, setDed80C] = useState(150000);
  const [ded80D, setDed80D] = useState(50000);
  const [hraEx, setHraEx] = useState(240000);
  const [homeLoanInt, setHomeLoanInt] = useState(0);
  const [nps1B, setNps1B] = useState(50000);

  const taxResult = useMemo(
    () =>
      compareIndianTaxRegimes({
        annualGrossIncome: grossIncome,
        deduction80C: ded80C,
        deduction80D: ded80D,
        hraExemption: hraEx,
        homeLoanInterest24B: homeLoanInt,
        nps80CCD1B: nps1B,
        isSalaried: true,
      }),
    [grossIncome, ded80C, ded80D, hraEx, homeLoanInt, nps1B]
  );

  // 3. Rent vs Buy State
  const [homePrice, setHomePrice] = useState(9500000);
  const [downPct, setDownPct] = useState(20);
  const [loanRate, setLoanRate] = useState(8.6);
  const [monthlyRent, setMonthlyRent] = useState(35000);
  const [rentBuyYears, setRentBuyYears] = useState(12);

  const rentBuyResult = useMemo(
    () =>
      compareRentVsBuy({
        homePrice,
        downPaymentPct: downPct,
        loanRatePct: loanRate,
        loanYears: 20,
        monthlyRent,
        rentGrowthPct: 6,
        homeAppreciationPct: 7,
        investmentReturnPct: 11,
        horizonYears: rentBuyYears,
      }),
    [homePrice, downPct, loanRate, monthlyRent, rentBuyYears]
  );

  // 4. Prepay Loan vs Invest State
  const [loanBal, setLoanBal] = useState(4000000);
  const [loanApr, setLoanApr] = useState(8.75);
  const [remMonths, setRemMonths] = useState(180);
  const [extraSurplus, setExtraSurplus] = useState(15000);
  const [investReturn, setInvestReturn] = useState(11.5);

  const prepayResult = useMemo(
    () =>
      comparePrepayVsInvest({
        outstandingLoan: loanBal,
        loanAprPct: loanApr,
        remainingMonths: remMonths,
        extraMonthlySurplus: extraSurplus,
        expectedInvestReturnPct: investReturn,
        investTaxDragPct: 12.5,
      }),
    [loanBal, loanApr, remMonths, extraSurplus, investReturn]
  );

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('calc.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('calc.subtitle')}</p>
        </div>
      )}

      {/* Calculator Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['fire', t('calc.tabFire'), Flame],
            ['tax', t('calc.tabTax'), Scale],
            ['rent-buy', t('calc.tabRentBuy'), Home],
            ['prepay', t('calc.tabPrepay'), Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              tab === id
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: FIRE PLANNER */}
      {tab === 'fire' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('calc.fireHeading')}
              </h2>
              <p className="text-xs text-slate-500">{t('calc.fireDesc')}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                fireResult.isViableToLifeExpectancy
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              }`}
            >
              {fireResult.isViableToLifeExpectancy
                ? t('calc.fireLastsBadge')
                : t('calc.fireRunsOutBadge', { age: fireResult.runsOutAge ?? 85 })}
            </span>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.curAge')}
              </span>
              <input
                type="number"
                value={curAge}
                onChange={(e) => setCurAge(Number(e.target.value) || 30)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.retireAge')}
              </span>
              <input
                type="number"
                value={retireAge}
                onChange={(e) => setRetireAge(Number(e.target.value) || 50)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.monthlySpendToday')}
              </span>
              <input
                type="number"
                value={monthlySpend}
                onChange={(e) => setMonthlySpend(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-[10px] text-slate-400">
                {formatIndianScaleHint(monthlySpend, language)}
              </span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.monthlySave')}
              </span>
              <input
                type="number"
                value={monthlySave}
                onChange={(e) => setMonthlySave(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-[10px] text-slate-400">
                {formatIndianScaleHint(monthlySave, language)}
              </span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.curCorpus')}
              </span>
              <input
                type="number"
                value={curCorpus}
                onChange={(e) => setCurCorpus(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.expectedReturnPct')}
              </span>
              <input
                type="number"
                step="0.5"
                value={fireReturn}
                onChange={(e) => setFireReturn(Number(e.target.value) || 8)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.inflationPct')}
              </span>
              <input
                type="number"
                step="0.5"
                value={fireInflation}
                onChange={(e) => setFireInflation(Number(e.target.value) || 5)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
                {t('calc.postRetTaxPct')}
              </span>
              <input
                type="number"
                step="0.5"
                value={postRetTax}
                onChange={(e) => setPostRetTax(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500">{t('calc.fireTargetNeeded')}</div>
              <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {formatMoney(fireResult.requiredFireCorpus, currency, privacy)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500">
                {t('calc.fireProjectedAtAge', { age: retireAge })}
              </div>
              <div className="mt-1 text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatMoney(fireResult.corpusAtRetirement, currency, privacy)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500">{t('calc.fireSurplusGap')}</div>
              <div
                className={`mt-1 text-lg font-extrabold ${
                  fireResult.surplusAtRetirement >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {fireResult.surplusAtRetirement >= 0 ? '+' : ''}
                {formatMoney(fireResult.surplusAtRetirement, currency, privacy)}
              </div>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">{t('calc.thAge')}</th>
                  <th className="px-3 py-2">{t('calc.thPhase')}</th>
                  <th className="px-3 py-2 text-right">{t('calc.thCashflow')}</th>
                  <th className="px-3 py-2 text-right">{t('calc.thEndCorpus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fireResult.rows
                  .filter((_, idx) => idx % 5 === 0 || idx === retireAge - curAge || idx === fireResult.rows.length - 1)
                  .map((r) => (
                    <tr key={r.age}>
                      <td className="px-3 py-1.5 font-bold">{r.age}</td>
                      <td className="px-3 py-1.5">
                        {r.phase === 'accumulate' ? t('calc.phaseSave') : t('calc.phaseRetire')}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-semibold ${
                          r.annualCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {r.annualCashflow >= 0 ? '+' : ''}
                        {formatMoney(r.annualCashflow, currency, privacy)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold">
                        {formatMoney(r.endCorpus, currency, privacy)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OLD VS NEW TAX REGIME (FY 2026-27) */}
      {tab === 'tax' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('calc.taxHeading')}
              </h2>
              <p className="text-xs text-slate-500">{t('calc.taxDesc')}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              {taxResult.recommended === 'new'
                ? t('calc.taxWinnerNew', {
                    amt: formatMoney(taxResult.savings, 'INR', false),
                  })
                : taxResult.recommended === 'old'
                ? t('calc.taxWinnerOld', {
                    amt: formatMoney(taxResult.savings, 'INR', false),
                  })
                : t('calc.taxEqual')}
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col justify-between text-xs">
              <span className="mb-1 block font-semibold">{t('calc.grossIncome')}</span>
              <div>
                <input
                  type="number"
                  aria-label={t('calc.grossIncome')}
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  {formatIndianScaleHint(grossIncome, language)}
                </span>
              </div>
            </label>
            <label className="flex flex-col justify-between text-xs">
              <span className="mb-1 block font-semibold">{t('calc.sec80C')}</span>
              <div>
                <input
                  type="number"
                  value={ded80C}
                  onChange={(e) => setDed80C(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="mt-0.5 block text-[10px] text-transparent" aria-hidden="true">
                  -
                </span>
              </div>
            </label>
            <label className="flex flex-col justify-between text-xs">
              <span className="mb-1 block font-semibold">{t('calc.sec80D')}</span>
              <div>
                <input
                  type="number"
                  value={ded80D}
                  onChange={(e) => setDed80D(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="mt-0.5 block text-[10px] text-transparent" aria-hidden="true">
                  -
                </span>
              </div>
            </label>
            <label className="flex flex-col justify-between text-xs">
              <span className="mb-1 block font-semibold">{t('calc.hraEx')}</span>
              <input
                type="number"
                value={hraEx}
                onChange={(e) => setHraEx(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="flex flex-col justify-between text-xs">
              <span className="mb-1 block font-semibold">{t('calc.sec24b')}</span>
              <input
                type="number"
                value={homeLoanInt}
                onChange={(e) => setHomeLoanInt(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="flex flex-col justify-between text-xs">
              <span className="mb-1 block font-semibold">{t('calc.sec80CCD1B')}</span>
              <input
                type="number"
                value={nps1B}
                onChange={(e) => setNps1B(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              className={`rounded-xl border p-4 ${
                taxResult.recommended === 'new'
                  ? 'border-emerald-400 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {t('calc.newRegimeLabel')}
              </div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatMoney(taxResult.newRegimeTax, 'INR', false)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {t('calc.taxableLine', {
                  taxable: formatMoney(taxResult.newRegimeTaxableIncome, 'INR', false),
                  rate: taxResult.effectiveNewRatePct,
                })}
              </div>
            </div>
            <div
              className={`rounded-xl border p-4 ${
                taxResult.recommended === 'old'
                  ? 'border-emerald-400 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {t('calc.oldRegimeLabel')}
              </div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatMoney(taxResult.oldRegimeTax, 'INR', false)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {t('calc.taxableLine', {
                  taxable: formatMoney(taxResult.oldRegimeTaxableIncome, 'INR', false),
                  rate: taxResult.effectiveOldRatePct,
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RENT VS BUY */}
      {tab === 'rent-buy' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
            {t('calc.rentBuyHeading')}
          </h2>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.homePrice')}</span>
              <input
                type="number"
                value={homePrice}
                onChange={(e) => setHomePrice(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.downPct')}</span>
              <input
                type="number"
                value={downPct}
                onChange={(e) => setDownPct(Number(e.target.value) || 20)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.loanRatePct')}</span>
              <input
                type="number"
                step="0.1"
                value={loanRate}
                onChange={(e) => setLoanRate(Number(e.target.value) || 8)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.monthlyRent')}</span>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.horizonYrs')}</span>
              <input
                type="number"
                value={rentBuyYears}
                onChange={(e) => setRentBuyYears(Number(e.target.value) || 10)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500">{t('calc.estMonthlyEmi')}</div>
              <div className="mt-1 text-lg font-extrabold">
                {formatMoney(rentBuyResult.monthlyEmi, currency, privacy)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500">{t('calc.buyNetWealth')}</div>
              <div className="mt-1 text-lg font-extrabold text-blue-600">
                {formatMoney(rentBuyResult.buyNetWealth, currency, privacy)}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30">
              <div className="text-[11px] text-slate-500">{t('calc.rentNetWealth')}</div>
              <div className="mt-1 text-lg font-extrabold text-emerald-600">
                {formatMoney(rentBuyResult.rentNetWealth, currency, privacy)}
              </div>
              <div className="mt-1 text-[11px] font-bold">
                {rentBuyResult.winner === 'buy'
                  ? t('calc.buyAheadBy', { amt: formatMoney(rentBuyResult.difference, currency, privacy) })
                  : t('calc.rentAheadBy', { amt: formatMoney(rentBuyResult.difference, currency, privacy) })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PREPAY LOAN VS INVEST */}
      {tab === 'prepay' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('calc.prepayHeading')}
            </h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Calculator className="mr-1 inline h-3.5 w-3.5" />
              {prepayResult.recommended === 'invest'
                ? t('calc.winnerInvest')
                : t('calc.winnerPrepay')}
            </span>
          </div>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.loanBalance')}</span>
              <input
                type="number"
                value={loanBal}
                onChange={(e) => setLoanBal(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.loanApr')}</span>
              <input
                type="number"
                step="0.1"
                value={loanApr}
                onChange={(e) => setLoanApr(Number(e.target.value) || 8)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.remMonths')}</span>
              <input
                type="number"
                value={remMonths}
                onChange={(e) => setRemMonths(Number(e.target.value) || 12)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.extraSurplus')}</span>
              <input
                type="number"
                value={extraSurplus}
                onChange={(e) => setExtraSurplus(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold">{t('calc.investCagr')}</span>
              <input
                type="number"
                step="0.5"
                value={investReturn}
                onChange={(e) => setInvestReturn(Number(e.target.value) || 10)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500">{t('calc.interestSavedPrepay')}</div>
              <div className="mt-1 text-lg font-extrabold text-blue-600">
                {formatMoney(prepayResult.interestSaved, currency, privacy)}
              </div>
              <div className="text-[11px] text-slate-500">
                {t('calc.monthsTrimmed', { m: prepayResult.monthsSaved })}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="text-[11px] text-slate-500">{t('calc.postTaxInvestGains')}</div>
              <div className="mt-1 text-lg font-extrabold text-emerald-600">
                {formatMoney(prepayResult.postTaxInvestGain, currency, privacy)}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30">
              <div className="text-[11px] text-slate-500">{t('calc.netAdvantage')}</div>
              <div className="mt-1 text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                +{formatMoney(prepayResult.netAdvantage, currency, privacy)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
