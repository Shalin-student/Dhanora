import React, { useState } from 'react';
import { CheckCircle2, Flame, ShieldCheck, TrendingUp } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

type PreviewTab = 'pulse' | 'sip' | 'shield';

export const HeroProductPreview: React.FC = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState<PreviewTab>('pulse');

  const tabs: Array<{ id: PreviewTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'pulse', label: t('pub.previewTab1'), icon: TrendingUp },
    { id: 'sip', label: t('pub.previewTab2'), icon: Flame },
    { id: 'shield', label: t('pub.previewTab3'), icon: ShieldCheck },
  ];

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-xl shadow-emerald-950/5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
      {/* Window Chrome + Interactive Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  active
                    ? 'bg-white text-emerald-700 shadow-2xs dark:bg-slate-900 dark:text-emerald-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Body */}
      {tab === 'pulse' && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                {t('pub.previewNetWorth')}
              </div>
              <div className="tabular-nums mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                ₹42.84L
              </div>
              <div className="mt-1 text-[10px] font-bold text-emerald-600">+14.2% YoY</div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {t('pub.previewSurplus')}
              </div>
              <div className="tabular-nums mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                ₹54,200
              </div>
              <div className="mt-1 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                32% Savings Rate
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200">
              <span>{t('pub.previewAllocTitle')}</span>
              <span className="text-emerald-600">50 / 30 / 20</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="bg-blue-500" style={{ width: '46%' }} />
              <div className="bg-amber-400" style={{ width: '22%' }} />
              <div className="bg-emerald-500" style={{ width: '32%' }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {t('pub.previewAllocNeeds')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                {t('pub.previewAllocWants')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {t('pub.previewAllocSave')}
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === 'sip' && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div>
              <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                {t('pub.previewSipTarget')}
              </div>
              <div className="tabular-nums mt-0.5 text-2xl font-extrabold text-slate-900 dark:text-white">
                ₹2.48 Cr
              </div>
            </div>
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">
              {t('pub.previewFireReady')}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="mb-2 flex items-end justify-between gap-2 h-24 pt-2">
              {[24, 34, 46, 62, 78, 96].map((h, idx) => (
                <div key={h} className="flex flex-1 flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-400"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[9px] font-bold text-slate-400">Y{(idx + 1) * 3}</span>
                </div>
              ))}
            </div>
            <div className="text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              ₹25,000/mo SIP + 10% annual step-up @ 12% CAGR
            </div>
          </div>
        </div>
      )}

      {tab === 'shield' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50/70 p-3.5 dark:border-teal-900/60 dark:bg-teal-950/30">
            <div>
              <div className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">
                {t('pub.previewShieldTitle')}
              </div>
              <div className="tabular-nums mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
                ₹1.50 Cr Term + ₹15L Health
              </div>
            </div>
            <span className="rounded-full bg-teal-600 px-2.5 py-1 text-[10px] font-bold text-white">
              {t('pub.previewShieldCovered')}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              'HDFC Savings & PPF Nominees Verified',
              'Emergency Will Folder Location Saved',
              'Zero Bank Passwords / PINs Stored',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
