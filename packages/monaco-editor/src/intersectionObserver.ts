import ObserverPolyfill from "./polyfill/intersectionObserver";

/**
 * Interface for objects that is handling the intersection events.
 */
export interface IIntersectable {
  onIntersecting(isIntersecting: boolean): void;
}

const monitoredIntersectables = new Map<Element, IIntersectable>();

let viewPortObserver: IntersectionObserver;
function getObserverSingleton() {
  if (!viewPortObserver) {
    const IntersectionObserverImpl = window.IntersectionObserver || ObserverPolyfill;

    viewPortObserver = new IntersectionObserverImpl((entries) => {
      for (const entry of entries) {
        const element = entry.target;
        const editor = monitoredIntersectables.get(element);
        if (editor) {
          editor.onIntersecting(entry.isIntersecting);
        }
      }
    });
  }

  return viewPortObserver;
}

/**
 * Observe the element for viewport intersection events.
 * @param editor
 * @param element
 * @returns callback to unobserve the element
 */
export function observe(intersectable: IIntersectable, element: Element): () => void {
  monitoredIntersectables.set(element, intersectable);
  getObserverSingleton().observe(element);

  return () => unobserve(element);
}

/**
 * unobserve the element for viewport intersection events.
 * @param element the monitored html element
 */
export function unobserve(element: Element): void {
  getObserverSingleton().unobserve(element);
  monitoredIntersectables.delete(element);
}
