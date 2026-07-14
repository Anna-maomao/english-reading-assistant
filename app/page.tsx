'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addBook, dueCounts } from '@/lib/db'
import { extractEpubMeta } from '@/lib/epub-meta'
import { extractPdfMeta } from '@/lib/pdf-meta'
import { extractMdMeta } from '@/lib/md-meta'
import { useApiKey, getApiKey } from '@/lib/api-key'
import ApiKeyDialog from '@/components/ApiKeyDialog'
import type { Book } from '@/types'

function BookCard({ book, onDelete }: { book: Book; onDelete: () => void }) {
  const router = useRouter()
  // 封面对象 URL 用 useMemo 派生，避免在 effect 里 setState 触发额外渲染
  const coverUrl = useMemo(
    () => (book.cover ? URL.createObjectURL(book.cover) : null),
    [book.cover]
  )

  useEffect(() => {
    if (!coverUrl) return
    return () => URL.revokeObjectURL(coverUrl)
  }, [coverUrl])

  return (
    <div
      onClick={() => router.push(`/read/${book.id}`)}
      className="group relative w-40 cursor-pointer select-none"
    >
      <div className="w-40 h-56 rounded-xl overflow-hidden shadow-md group-hover:shadow-xl transition-shadow bg-amber-100 flex items-center justify-center">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">📖</span>
        )}
      </div>
      {book.progress != null && (
        <div className="absolute top-2 right-2 bg-black/55 text-white text-[10px] px-2 py-0.5 rounded-full">
          {Math.round(book.progress * 100)}%
        </div>
      )}
      <button
        onClick={e => {
          e.stopPropagation()
          if (confirm(`删除《${book.title}》？生词和句子记录会保留。`)) onDelete()
        }}
        className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/40 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        title="删除书籍"
      >
        ×
      </button>
      <p className="mt-2 text-sm font-semibold text-amber-900 truncate">{book.title}</p>
      {book.author && <p className="text-xs text-amber-500 truncate">{book.author}</p>}
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const apiKey = useApiKey()

  const books = useLiveQuery(() => db.books.orderBy('lastReadAt').reverse().toArray(), [])
  const due = useLiveQuery(() => dueCounts(), [], { words: 0, sentences: 0 })
  const wordCount = useLiveQuery(() => db.words.count(), [], 0)

  // 第一次打开（本地没存 key、且没点过「先逛逛」）才自动弹出配置框。
  // 在 effect 里同步读 localStorage —— 已存 key 或点过略过就不再弹，避免每次回首页都被打扰。
  useEffect(() => {
    if (!getApiKey() && !localStorage.getItem('deepseek_key_prompt_skipped')) {
      // 必须延到客户端读 localStorage 后再决定是否弹窗，避免 SSR 水合不一致
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowKeyDialog(true)
    }
  }, [])

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase()
    const isEpub = name.endsWith('.epub')
    const isPdf = name.endsWith('.pdf')
    const isMd = name.endsWith('.md') || name.endsWith('.markdown')
    if (!isEpub && !isPdf && !isMd) {
      alert('请上传 .epub、.pdf 或 .md 格式的文件')
      return
    }
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      let meta
      if (isPdf) {
        meta = { ...(await extractPdfMeta(buffer)), format: 'pdf' as const }
      } else if (isMd) {
        const m = extractMdMeta(buffer)
        // .md 无内嵌标题时用「去扩展名的文件名」兜底
        const fallback = file.name.replace(/\.(md|markdown)$/i, '').trim() || '未命名文档'
        meta = { ...m, title: m.title || fallback, format: 'md' as const }
      } else {
        meta = { ...(await extractEpubMeta(buffer)), format: 'epub' as const }
      }
      const id = await addBook(new Blob([buffer]), meta)
      router.push(`/read/${id}`)
    } catch (err) {
      console.error(err)
      const kind = isPdf ? 'PDF' : isMd ? 'Markdown' : 'EPUB'
      alert(`导入失败，请确认文件是有效的 ${kind}`)
    } finally {
      setImporting(false)
    }
  }

  const totalDue = due.words + due.sentences
  const hasBooks = (books?.length ?? 0) > 0

  return (
    <main className="min-h-screen bg-[#faf8fc] px-8 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-purple-900 tracking-tight">开卷有益</h1>
            <p className="text-purple-600 mt-1 text-sm">翻开就是收获</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyDialog(true)}
              title="配置 API Key"
              aria-label="配置 API Key"
              className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
                apiKey
                  ? 'text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200'
                  : 'text-white bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {apiKey ? '⚙️ API Key' : '⚙️ 设置 API Key'}
            </button>
            <Link
              href="/library"
              className="text-sm text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-4 py-1.5 rounded-full transition-colors"
            >
              生词本 {wordCount > 0 && <span className="font-semibold">{wordCount}</span>}
            </Link>
          </div>
        </div>

        {/* 复习提醒 */}
        {totalDue > 0 && (
          <Link
            href="/review"
            className="block mb-8 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl px-6 py-5 shadow-lg transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">今天有 {totalDue} 项待复习</p>
                <p className="text-amber-100 text-sm mt-0.5">
                  {due.words > 0 && `${due.words} 个生词`}
                  {due.words > 0 && due.sentences > 0 && ' · '}
                  {due.sentences > 0 && `${due.sentences} 个句子`}
                </p>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Link>
        )}

        {/* 书架 */}
        <div className="flex flex-wrap gap-6">
          {books?.map(book => (
            <BookCard key={book.id} book={book} onDelete={() => db.books.delete(book.id)} />
          ))}

          {/* 导入 */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
            onClick={() => document.getElementById('fileInput')?.click()}
            className={`w-40 h-56 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all select-none
              ${isDragging
                ? 'border-purple-500 bg-purple-50 scale-105'
                : 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
          >
            {importing ? (
              <span className="text-purple-500 text-sm animate-pulse">导入中…</span>
            ) : (
              <>
                <span className="text-4xl mb-2">＋</span>
                <p className="text-purple-800 text-sm font-semibold">{hasBooks ? '添加书籍' : '导入 EPUB / PDF / MD'}</p>
                <p className="text-purple-400 text-xs mt-1">拖入或点击</p>
              </>
            )}
          </div>
        </div>

        <input
          id="fileInput"
          type="file"
          accept=".epub,.pdf,.md,.markdown"
          className="hidden"
          onChange={e => {
            if (e.target.files?.[0]) handleFile(e.target.files[0])
            e.target.value = ''
          }}
        />
      </div>

      <ApiKeyDialog
        open={showKeyDialog}
        dismissable
        onClose={() => {
          // 没填 key 就关掉 = 选择「先逛逛」，记下来别再自动打扰（仍可点右上角设置随时配置）
          if (!getApiKey()) localStorage.setItem('deepseek_key_prompt_skipped', '1')
          setShowKeyDialog(false)
        }}
      />
    </main>
  )
}
