import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 4000 });

const store = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return store.size;
  },
  clear() {
    store.clear();
  },
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  key(index: number) {
    return Array.from(store.keys())[index] ?? null;
  },
  removeItem(key: string) {
    store.delete(key);
  },
  setItem(key: string, value: string) {
    store.set(key, String(value));
  },
};

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}
if (typeof window !== 'undefined' && (typeof window.localStorage === 'undefined' || typeof window.localStorage?.clear !== 'function')) {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}
