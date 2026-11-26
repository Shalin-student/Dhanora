import React, { useEffect, useState } from 'react';
import { Download, FileImage, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { useModalA11y } from '../hooks/useModalA11y';
import type { ReceiptRecord } from '../types/finance';
import { formatMoney } from '../utils/currency';
import { formatBytes, processReceiptFile } from '../utils/image';
import { useI18n } from '../i18n/useI18n';

export const ReceiptLightboxModal: React.FC = () => {
  const {
    state,
    receiptPreviewTxId,
    closeReceiptPreview,
    getReceiptWithSync,
    attachReceiptToTransaction,
    removeReceiptFromTransaction,
  } = useFinance();
  const { t } = useI18n();

  const [record, setRecord] = useState<ReceiptRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const modalRef = useModalA11y(Boolean(receiptPreviewTxId), closeReceiptPreview);

  const tx = state.transactions.find((tItem) => tItem.id === receiptPreviewTxId);

  useEffect(() => {
    setZoomed(false);
    if (!tx?.receiptId) {
      setRecord(null);
      return;
    }
    let active = true;
    setLoading(true);
    getReceiptWithSync(tx.receiptId)
      .then((rec) => {
        if (active) setRecord(rec);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tx?.id, tx?.receiptId, getReceiptWithSync]);

  if (!receiptPreviewTxId || !tx) return null;

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await processReceiptFile(file);
    await attachReceiptToTransaction(tx.id, processed);
    const updated = await getReceiptWithSync(`rcpt-${tx.id}`);
    setRecord(updated);
  };

  const handleDelete = async () => {
    await removeReceiptFromTransaction(tx.id);
    closeReceiptPreview();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-lightbox-title"
    >
      <div
        ref={modalRef}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id="receipt-lightbox-title"
              className="truncate text-base font-bold text-slate-900 dark:text-white"
            >
              {t('lightbox.title', { merchant: tx.merchant })}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tx.date} • {formatMoney(tx.amount, tx.currency, state.settings.privacyMode)}
              {record ? ` • ${record.fileName} (${formatBytes(record.sizeBytes)})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={closeReceiptPreview}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t('lightbox.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4 text-center dark:bg-slate-950">
          {loading ? (
            <div className="py-16 text-xs font-medium text-slate-500">
              {t('lightbox.loading')}
            </div>
          ) : !record ? (
            <div className="py-16 text-sm text-slate-500">
              <FileImage className="mx-auto mb-2 h-8 w-8 opacity-50" />
              {t('lightbox.empty')}
            </div>
          ) : record.mimeType.startsWith('image/') ? (
            <img
              src={record.dataUrl}
              alt={t('lightbox.title', { merchant: tx.merchant })}
              className={`mx-auto rounded-xl border border-slate-200 shadow-sm transition-transform dark:border-slate-800 ${
                zoomed
                  ? 'max-w-none scale-125 cursor-zoom-out'
                  : 'max-h-[60vh] cursor-zoom-in object-contain'
              }`}
              onClick={() => setZoomed((z) => !z)}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
              <FileImage className="mx-auto mb-3 h-10 w-10 text-blue-500" />
              <p className="text-sm font-semibold">{record.fileName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {record.mimeType} • {formatBytes(record.sizeBytes)}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {record?.mimeType.startsWith('image/') && (
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
                {zoomed ? t('lightbox.fit') : t('lightbox.zoom')}
              </button>
            )}
            {record && (
              <a
                href={record.dataUrl}
                download={record.fileName}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                {t('lightbox.download')}
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <Upload className="h-3.5 w-3.5" />
              {t('lightbox.replace')}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => void handleReplace(e)}
              />
            </label>
            {tx.receiptId && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('lightbox.remove')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
