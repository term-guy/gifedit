// Polyfill ImageData for happy-dom test environment
// happy-dom doesn't ship ImageData, but our code and tests use it.

class ImageDataPolyfill {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
  readonly colorSpace: string

  constructor(
    arg1: number | Uint8ClampedArray,
    arg2: number,
    arg3?: number | { colorSpace?: string },
    arg4?: { colorSpace?: string },
  ) {
    let settings: { colorSpace?: string } | undefined

    if (typeof arg1 === 'number') {
      // (width, height) or (width, height, settings)
      this.width = arg1
      this.height = arg2
      this.data = new Uint8ClampedArray(arg1 * arg2 * 4)
      settings = arg3 as { colorSpace?: string } | undefined
    } else {
      // (data, width) or (data, width, height) or (data, width, height, settings)
      this.data = arg1
      this.width = arg2
      if (typeof arg3 === 'object') {
        // (data, width, settings)
        this.height = (arg1.length / (arg2 * 4)) | 0
        settings = arg3
      } else {
        this.height = typeof arg3 === 'number' ? arg3 : (arg1.length / (arg2 * 4)) | 0
        settings = arg4
      }
    }
    this.colorSpace = settings?.colorSpace ?? 'srgb'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).ImageData = ImageDataPolyfill as any
