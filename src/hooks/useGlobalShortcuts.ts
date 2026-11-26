import { useEffect } from 'react';

/**
 * Registers global keyboard shortcuts: Ctrl/Cmd+K (Command Palette) and 'N' (Quick Entry).
 */
export function useGlobalShortcuts(options: {
  isAnyModalOpen: boolean;
  onToggleCommandPalette: () => void;
  onOpenQuickAdd: () => void;
}): void {
  const { isAnyModalOpen, onToggleCommandPalette, onOpenQuickAdd } = options;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleCommandPalette();
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (!isInput && !isAnyModalOpen && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onOpenQuickAdd();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnyModalOpen, onToggleCommandPalette, onOpenQuickAdd]);
}
