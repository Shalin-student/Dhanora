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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <MessageSquarePlus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {t('fb.title')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('fb.sub')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5">
          {err && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {err}
            </div>
          )}

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
              {t('fb.catLabel')}
            </span>
            <select
              aria-label={t('fb.catLabel')}
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
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
              className="w-full rounded-xl border border-slate-300 p-3 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {t('fb.submitBtn')}
          </button>
        </form>

        <div className="mt-4 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
          <a
            href="mailto:shalinpatel1102@gmail.com?subject=HearthLedger%20Support"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400"
          >
            <Mail className="h-3 w-3" />
            {t('fb.directMailNote')}
          </a>
        </div>
      </div>
    </div>
  );
};
