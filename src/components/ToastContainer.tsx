import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { useI18n } from '../i18n/useI18n';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useFinance();
  const { t } = useI18n();

  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#404944]/40 bg-[#283044] px-4 py-3 text-xs font-medium text-[#eef0ff] shadow-xl"
        >
          <span className="leading-snug">{toast.message}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  dismissToast(toast.id, false);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#fe932c] px-2.5 py-1 text-xs font-bold text-[#2f1500] hover:bg-[#ffb77d]"
              >
                <RotateCcw className="h-3 w-3" />
                {t('toast.undo')}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-1 text-[#bfc9c3] hover:bg-white/10 hover:text-white"
              aria-label={t('a11y.dismissToast')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
