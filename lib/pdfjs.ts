// 统一加载并配置 pdf.js（worker 只配一次）。仅在浏览器端使用。
import * as pdfjsLib from 'pdfjs-dist'

// Turbopack 会把 worker 解析成带 hash 的静态资源 URL
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// getDocument 会「转移」并清空传入的 buffer，调用方需自行传副本
export function loadPdf(buffer: ArrayBuffer) {
  return pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
}

export const TextLayer = pdfjsLib.TextLayer
export { pdfjsLib }
export type PdfDoc = Awaited<ReturnType<typeof loadPdf>>
