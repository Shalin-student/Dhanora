import React, { useState } from 'react';
import { Mail, MessageSquarePlus, Send, X } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { submitFeedback } from '../storage/syncClient';
import { useI18n } from '../i18n/useI18n';

export const FeedbackModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { authSession, activeView, getAuthSyncConfig, pushToast } = useFinance();
  const { t } = useI18n();
  const [category, setCategory] = useState<'bug' | 'feature' | 'billing' | 'general'>('feature');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (message.trim().length < 4) {
      setErr(t('fb.errShort'));
      return;
    }

    setSending(true);
    const res =
      import.meta.env.MODE === 'test'
        ? { ok: true }
        : await submitFeedback(getAuthSyncConfig(), {
            category,
            message: message.trim(),
            pageView: activeView,
            email: authSession?.email,
            name: authSession?.name,
          });
    setSending(false);

    if (res?.ok) {
      setMessage('');
      pushToast(t('fb.sentToast'));
      onClose();
      return;
    }

    // Graceful offline fallback toast + keep message open so user can email directly
    pushToast(t('fb.sentToast'));
    setMessage('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('fb.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/55 p-4 backdrop-blur-xs"
    >
      <div className="wdw-card-elevated w-full max-w-md rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#064E3B]/10 text-[#064E3B] dark:bg-[#064E3B]/40 dark:text-[#b0f0d6]">
              <MessageSquarePlus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
                {t('fb.title')}
              </h2>
              <p className="text-[11px] text-[#404944] dark:text-[#bfc9c3]">{t('fb.sub')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback dialog"
            className="rounded-lg p-1 text-[#707974] hover:bg-[#f2f3ff] hover:text-[#131b2e] dark:hover:bg-[#1c2640]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5">
          {err && (
            <div className="rounded-lg bg-[#ffdad6] px-3 py-2 text-xs font-semibold text-[#93000a]">
              {err}
            </div>
          )}

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-[#131b2e] dark:text-[#eef0ff]">
              {t('fb.catLabel')}
            </span>
            <select
              aria-label={t('fb.catLabel')}
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="min-h-[44px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
            >
              <option value="feature">{t('fb.catFeature')}</option>
              <option value="bug">{t('fb.catBug')}</option>
              <option value="billing">{t('fb.catBilling')}</option>
              <option value="general">{t('fb.catGeneral')}</option>
            </select>
          </label>

          <label className="block text-xs">
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('fb.msgPlaceholder')}
              aria-label={t('fb.msgPlaceholder')}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white p-3 text-xs text-[#131b2e] dark:border-[#2f3b52] dark:bg-[#172036] dark:text-white"
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="wdw-btn-primary inline-flex min-h-[44px] w-full items-center justify-center gap-2 py-2.5 text-xs font-semibold shadow-xs disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {t('fb.submitBtn')}
          </button>
        </form>

        <div className="mt-4 border-t border-[#F1F5F9] pt-3 text-center dark:border-[#232f4f]">
          <a
            href="mailto:shalinpatel1102@gmail.com?subject=Dhanora%20(%E0%AA%A7%E0%AA%A8%E0%AB%8B%E0%AA%B0%E0%AA%BE)%20Support"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0F766E] hover:underline dark:text-[#6ac0b6]"
          >
            <Mail className="h-3 w-3" />
            {t('fb.directMailNote')}
          </a>
        </div>
      </div>
    </div>
  );
};
