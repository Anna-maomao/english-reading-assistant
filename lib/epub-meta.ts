// 从 EPUB 文件中提取书名、作者、封面，用于书架展示
export async function extractEpubMeta(buffer: ArrayBuffer): Promise<{
  title: string
  author: string
  cover: Blob | null
}> {
  const Epub = (await import('epubjs')).default
  const book = Epub(buffer)
  try {
    await book.ready
    const meta = await book.loaded.metadata
    let cover: Blob | null = null
    try {
      const coverUrl = await book.coverUrl()
      if (coverUrl) {
        cover = await (await fetch(coverUrl)).blob()
      }
    } catch {
      // 没有封面不影响导入
    }
    return {
      title: meta.title || '未命名书籍',
      author: meta.creator || '',
      cover,
    }
  } finally {
    book.destroy()
  }
}
