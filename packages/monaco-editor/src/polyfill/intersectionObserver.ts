/**
 * Polyfill for DOMRect
 */
class DOMRectPolyfill {
  constructor(public x: number, public y: number, public width: number, public height: number) {}
}

/**
 * Polyfill for IntersectionObserver
 * Always reports the element as intersecting when it is observed.
 */
export default class AlwaysIntersectingObserver {
  constructor(private callback: IntersectionObserverCallback) {}

  observe(element: Element): void {
    const DOMRectImpl = window.DOMRect || DOMRectPolyfill;
    // we don't want to cause a reflow if we read the DOM, so we use a dummy rect
    const dummyRect = new DOMRectImpl(0, 0, 0, 0);

    this.callback(
      [
        {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: dummyRect, // should not be used by the callback
          rootBounds: null,
          intersectionRect: dummyRect, // should not be used by the callback
          time: performance.now()
        }
      ],
      this
    );
  }

  unobserve(element: Element): void {
    element;
  }

  /**
   * The following methods are not implemented, but are required by the interface.
   */
  root: Element | null = null;
  rootMargin: string = "";
  thresholds: number[] = [];
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
