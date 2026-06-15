// 从 PDF 文件中提取书名、作者，并把第一页渲染成封面缩略图
// 注意：pdf.js 在模块求值阶段会用到 DOMMatrix 等浏览器 API，
// 必须在函数内动态 import，避免被服务端预渲染时静态加载。

export async function extractPdfMeta(buffer: ArrayBuffer): Promise<{
  title: string
  author: string
  cover: Blob | null
}> {
  const { loadPdf } = await import('./pdfjs')
  const pdf = await loadPdf(buffer)
  try {
    let title = ''
    let author = ''
    try {
      const { info } = (await pdf.getMetadata()) as { info?: { Title?: string; Author?: string } }
      title = info?.Title?.trim() ?? ''
      author = info?.Author?.trim() ?? ''
    } catch {
      // 没有元数据不影响导入
    }

    // 用第一页渲染封面
    let cover: Blob | null = null
    try {
      const page = await pdf.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(2, 600 / base.width) // 封面宽度约 600px
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, viewport }).promise
      cover = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.8)
      )
      page.cleanup()
    } catch {
      // 渲染封面失败就用占位图标
    }

    return { title: title || '未命名 PDF', author, cover }
  } finally {
    // v6：销毁文档要走 loadingTask.destroy()，PDFDocumentProxy 本身没有 destroy()
    void pdf.loadingTask.destroy()
  }
}
