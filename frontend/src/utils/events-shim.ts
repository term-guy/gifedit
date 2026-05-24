// Minimal EventEmitter shim for browser-incompatible CJS deps (e.g. gif-encoder-2)
export class EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(_event: string, _listener: (...args: any[]) => void): this { return this }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(_event: string, ..._args: any[]): boolean { return false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(_event: string, _listener: (...args: any[]) => void): this { return this }
}

export default EventEmitter
