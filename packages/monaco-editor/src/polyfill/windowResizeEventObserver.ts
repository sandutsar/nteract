/**
 * Simple polifill of ResizeObserver for testing
 */
class ResizeObserver {
  elements: Set<Element> = new Set();
  constructor(private callback: ResizeObserverCallback) {
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener("resize", this.onWindowResize);
  }

  onWindowResize() {
    const entries: ResizeObserverEntry[] = [];
    for (const element of this.elements) {
      entries.push({
        target: element,
        contentRect: element.getBoundingClientRect(),
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: []
      });
    }

    this.callback(entries, this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    window.removeEventListener("resize", this.onWindowResize);
  }
}

export default ResizeObserver;
