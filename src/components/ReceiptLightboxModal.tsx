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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-lightbox-title"
    >
      <div
        ref={modalRef}
        className="wdw-card-elevated flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-3.5 dark:border-[#232f4f]">
          <div className="min-w-0">
            <h2
              id="receipt-lightbox-title"
              className="truncate text-base font-bold text-[#131b2e] dark:text-white"
            >
              {t('lightbox.title', { merchant: tx.merchant })}
            </h2>
            <p className="font-numeric text-xs text-[#404944] dark:text-[#bfc9c3]">
              {tx.date} • {formatMoney(tx.amount, tx.currency, state.settings.privacyMode)}
              {record ? ` • ${record.fileName} (${formatBytes(record.sizeBytes)})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={closeReceiptPreview}
            className="rounded-lg p-1.5 text-[#707974] hover:bg-[#f2f3ff] dark:hover:bg-[#1c2640]"
            aria-label={t('lightbox.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-[#f2f3ff] p-4 text-center dark:bg-[#0b1120]">
          {loading ? (
            <div className="py-16 text-xs font-medium text-[#404944] dark:text-[#bfc9c3]">
              {t('lightbox.loading')}
            </div>
          ) : !record ? (
            <div className="py-16 text-sm text-[#404944] dark:text-[#bfc9c3]">
              <FileImage className="mx-auto mb-2 h-8 w-8 opacity-50" />
              {t('lightbox.empty')}
            </div>
          ) : record.mimeType.startsWith('image/') ? (
            <img
              src={record.dataUrl}
              alt={t('lightbox.title', { merchant: tx.merchant })}
              className={`mx-auto rounded-xl border border-[#bfc9c3]/50 shadow-sm transition-transform dark:border-[#2f3b52] ${
                zoomed
                  ? 'max-w-none scale-125 cursor-zoom-out'
                  : 'max-h-[60vh] cursor-zoom-in object-contain'
              }`}
              onClick={() => setZoomed((z) => !z)}
            />
          ) : (
            <div className="wdw-card p-8">
              <FileImage className="mx-auto mb-3 h-10 w-10 text-[#0F766E]" />
              <p className="text-sm font-semibold">{record.fileName}</p>
              <p className="mt-1 text-xs text-[#404944] dark:text-[#bfc9c3]">
                {record.mimeType} • {formatBytes(record.sizeBytes)}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] px-5 py-3 dark:border-[#232f4f]">
          <div className="flex items-center gap-2">
            {record?.mimeType.startsWith('image/') && (
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
              >
                {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
                {zoomed ? t('lightbox.fit') : t('lightbox.zoom')}
              </button>
            )}
            {record && (
              <a
                href={record.dataUrl}
                download={record.fileName}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]"
              >
                <Download className="h-3.5 w-3.5" />
                {t('lightbox.download')}
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-[#f2f3ff] dark:border-[#2f3b52] dark:text-[#eef0ff] dark:hover:bg-[#1c2640]">
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#ba1a1a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#93000a]"
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
