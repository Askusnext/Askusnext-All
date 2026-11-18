// antd reads matchMedia and getComputedStyle; jsdom lacks the former.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
});
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

// jsdom does not implement the pseudo-element form of getComputedStyle that antd's table measures; plain calls still work.
const realGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((el: Element, pseudo?: string | null) => realGetComputedStyle(el)) as typeof window.getComputedStyle;
