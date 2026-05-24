declare module 'gif-encoder-2' {
  class GIFEncoder {
    constructor(
      width: number,
      height: number,
      algorithm?: 'neuquant' | 'octree',
      useOptimizer?: boolean,
      totalFrames?: number,
    )
    out: { data: number[] }
    start(): void
    finish(): void
    setRepeat(repeat: number): void
    setDelay(ms: number): void
    setQuality(quality: number): void
    setThreshold(percent: number): void
    addFrame(context: CanvasRenderingContext2D): void
  }

  export default GIFEncoder
}
