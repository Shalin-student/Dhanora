import React, { useState } from 'react';
import { CheckCircle2, Flame, ShieldCheck, TrendingUp } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import { BilingualChip } from './WdwPrimitives';

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
    <div className="wdw-card-elevated rounded-3xl p-4 sm:p-5">
      {/* Window Chrome + Interactive Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3 dark:border-[#232f4f]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ba1a1a]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
          </div>
          <BilingualChip latin="Family Vault" gujarati="પરિવાર તિજોરી" tone="spruce" className="hidden sm:inline-flex" />
        </div>
        <div className="flex rounded-xl bg-[#f2f3ff] p-0.5 dark:bg-[#172036]">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-white text-[#064E3B] shadow-2xs dark:bg-[#232f4f] dark:text-[#b0f0d6]'
                    : 'text-[#404944] hover:text-[#131b2e] dark:text-[#bfc9c3]'
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Signature Shared Household Net Worth Hero Card */}
            <div className="wdw-hero-vault flex flex-col justify-between p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="label-caps text-[#A7F3D0]">{t('pub.previewNetWorth')}</span>
                <div className="flex -space-x-1.5" aria-hidden="true">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#b0f0d6] bg-[#003527] text-[10px]">
                    👩🏻
                  </span>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#fe932c] bg-[#283044] text-[10px]">
                    👨🏻
                  </span>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#6ac0b6] bg-[#004d47] text-[10px]">
                    🧒🏽
                  </span>
                </div>
              </div>
              <div className="font-numeric mt-2 text-2xl font-bold text-white">₹42.84L</div>
              <div className="font-numeric mt-1 text-[11px] font-semibold text-[#A7F3D0]">
                +14.2% YoY • Mint Verified
              </div>
            </div>

            {/* Individual Spend & Allowance Tracker Card */}
            <div className="wdw-card flex flex-col justify-between p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label-caps text-[#404944] dark:text-[#bfc9c3]">
                  {t('pub.previewSurplus')}
                </span>
                <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#904d00]">
                  32% Saved
                </span>
              </div>
              <div className="font-numeric mt-2 text-2xl font-bold text-[#131b2e] dark:text-white">
                ₹54,200
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#eaedff] dark:bg-[#1c2640]">
                  <div className="bg-[#D97706]" style={{ width: '58%' }} />
                  <div className="bg-[#10B981]" style={{ width: '42%' }} />
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-[#404944] dark:text-[#bfc9c3]">
                  <span>Budget Limit</span>
                  <span className="text-[#0F766E] dark:text-[#80d5cb]">Safe Allowance</span>
                </div>
              </div>
            </div>
          </div>

          {/* 50 / 30 / 20 & Bilingual Ledger Strip */}
          <div className="wdw-surface-tier rounded-2xl p-3.5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#131b2e] dark:text-[#eef0ff]">
              <span>{t('pub.previewAllocTitle')}</span>
              <span className="font-numeric text-[#064E3B] dark:text-[#b0f0d6]">50 / 30 / 20</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#dae2fd] dark:bg-[#283044]">
              <div className="bg-[#064E3B]" style={{ width: '46%' }} />
              <div className="bg-[#D97706]" style={{ width: '22%' }} />
              <div className="bg-[#10B981]" style={{ width: '32%' }} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-[#404944] dark:text-[#bfc9c3]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#064E3B]" />
                {t('pub.previewAllocNeeds')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                {t('pub.previewAllocWants')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                {t('pub.previewAllocSave')}
              </span>
            </div>
          </div>

          {/* Sample Bilingual Transaction Row */}
          <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3 dark:border-[#232f4f]">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FEF3C7] text-sm">
                🛒
              </span>
              <div>
                <div className="text-xs font-semibold text-[#131b2e] dark:text-white">D-Mart Supermarket</div>
                <BilingualChip latin="Groceries" gujarati="કરિયાણું" tone="spruce" className="mt-0.5 py-0.5 text-[10px]" />
              </div>
            </div>
            <div className="text-right">
              <div className="font-numeric text-sm font-semibold text-[#131b2e] dark:text-white">-₹2,840</div>
              <div className="text-[10px] text-[#404944] dark:text-[#bfc9c3]">👨🏻 Partner</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'sip' && (
        <div className="mt-4 space-y-4">
          <div className="wdw-hero-vault flex items-center justify-between p-4">
            <div>
              <div className="label-caps text-[#A7F3D0]">{t('pub.previewSipTarget')}</div>
              <div className="font-numeric mt-1 text-2xl font-bold text-white">₹2.48 Cr</div>
            </div>
            <span className="rounded-full bg-[#10B981]/25 px-3 py-1 text-[11px] font-semibold text-[#b0f0d6] ring-1 ring-[#b0f0d6]/30">
              {t('pub.previewFireReady')}
            </span>
          </div>

          <div className="wdw-surface-tier rounded-2xl p-3.5">
            <div className="mb-2 flex h-24 items-end justify-between gap-2 pt-2">
              {[24, 34, 46, 62, 78, 96].map((h, idx) => (
                <div key={h} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#064E3B] via-[#0F766E] to-[#10B981]"
                    style={{ height: `${h}%` }}
                  />
                  <span className="font-numeric text-[10px] font-semibold text-[#404944] dark:text-[#bfc9c3]">
                    Y{(idx + 1) * 3}
                  </span>
                </div>
              ))}
            </div>
            <div className="font-numeric text-center text-[11px] font-medium text-[#404944] dark:text-[#bfc9c3]">
              ₹25,000/mo SIP + 10% annual step-up @ 12% CAGR
            </div>
          </div>
        </div>
      )}

      {tab === 'shield' && (
        <div className="mt-4 space-y-3">
          <div className="wdw-hero-vault flex items-center justify-between p-4">
            <div>
              <div className="label-caps text-[#A7F3D0]">{t('pub.previewShieldTitle')}</div>
              <div className="font-numeric mt-1 text-lg font-bold text-white">
                ₹1.50 Cr Term + ₹15L Health
              </div>
            </div>
            <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-bold text-[#904d00]">
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
                className="flex items-center gap-2 rounded-xl border border-[#F1F5F9] bg-white px-3 py-2.5 font-semibold text-[#131b2e] dark:border-[#232f4f] dark:bg-[#172036] dark:text-[#eef0ff]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
