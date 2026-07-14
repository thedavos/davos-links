import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

const makeCanvasContext = (canvas: HTMLCanvasElement) =>
  ({
    canvas,
    clearRect: () => undefined,
    drawImage: () => undefined,
    fillRect: () => undefined,
    fillStyle: '',
  }) as unknown as CanvasRenderingContext2D

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value(this: HTMLCanvasElement, contextId: string) {
    return contextId === '2d' ? makeCanvasContext(this) : null
  },
})

Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get: () => 640,
})

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get: () => 240,
})

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    bottom: 240,
    height: 240,
    left: 0,
    right: 640,
    top: 0,
    width: 640,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}

class MockResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [
        {
          borderBoxSize: [],
          contentBoxSize: [],
          contentRect: target.getBoundingClientRect(),
          devicePixelContentBoxSize: [],
          target,
        } as unknown as ResizeObserverEntry,
      ],
      this,
    )
  }

  disconnect() {}
  unobserve() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: MockResizeObserver,
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  }),
})

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  configurable: true,
  writable: true,
  value: (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now() + 1_000), 0),
})

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  configurable: true,
  writable: true,
  value: (id: number) => window.clearTimeout(id),
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
