/**
 * This module is responsible for monitoring elements and call the resizable components.
 */

import ResizeObserverPolyfill from "./polyfill/windowResizeEventObserver";

/**
 * Interface for resizable components.
 */
export interface IResizable {
  onResize(): void;
}

/**
 * ResizeObserver that monitors the size of the element and calls the resizable component.
 */
const monitoredResizables = new WeakMap<Element, IResizable>();

/**
 * ResizeObserver that monitors the size of the element and calls the resizable component.
 */
let resizeObserver: ResizeObserver;
function getResizeObserverSingleton() {
  if (!resizeObserver) {
    const ResizeObserverImpl = window.ResizeObserver || ResizeObserverPolyfill;

    resizeObserver = new ResizeObserverImpl((entries) => {
      for (const entry of entries) {
        if (monitoredResizables.has(entry.target)) {
          const editor = monitoredResizables.get(entry.target);
          editor?.onResize();
        }
      }
    });
  }

  return resizeObserver;
}

/**
 * Observe the element for resize events.
 */
export function observe(resizable: IResizable, element: HTMLDivElement): () => void {
  monitoredResizables.set(element, resizable);
  getResizeObserverSingleton().observe(element);
  return () => unobserve(element);
}

/**
 * Unobserve the element for resize events.
 */
export function unobserve(element: HTMLDivElement): void {
  getResizeObserverSingleton().unobserve(element);
  monitoredResizables.delete(element);
}
