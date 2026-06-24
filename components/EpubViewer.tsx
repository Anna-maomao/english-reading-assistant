'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Book, NavItem } from 'epubjs'
import type { TocItem } from '@/types'

// epubjs 自带的类型与其运行时行为有出入（缺 removeOverride、getContents 实际返回数组、
// Contents 缺 range 等），这里用本地最小接口包住实际用到的成员，避免 any 又不破坏编译。
interface EpubContents {
  document: Document
  window: Window
  range: (cfiRange: string) => Range
}
interface EpubRendition {
  themes: {
    override: (name: string, value: string, priority?: boolean) => void
    removeOverride: (name: string) => void
    default: (rules: Record<string, Record<string, string>>) => void
  }
  display: (target?: string) => Promise<void>
  next: () => void
  prev: () => void
  resize: (width: number, height: number) => void
  getContents?: () => EpubContents[]
  hooks: { content: { register: (cb: (contents: EpubContents) => void) => void } }
  on: (event: string, listener: (arg: unknown, contents: unknown) => void) => void
}
interface EpubLocation {
  atStart?: boolean
  atEnd?: boolean
  start?: { cfi?: string; href?: string }
  end?: { cfi?: string }
}

export interface LocationInfo {
  startCfi: string
  chapter: string
  href: string // 当前章节 href（不含 hash），用于高亮目录
  startPercentage: number | null
  endPercentage: number | null
}

export interface ViewerApi {
  goTo: (target: string) => void
  // 读取当前视口顶部位置，用于添加书签
  getCurrent: () => { cfi: string; chapter: string; excerpt: string; percentage: number | null } | null
}

interface EpubViewerProps {
  data: ArrayBuffer | null
  initialLocation?: string | null
  savedWords?: string[] // 规范化小写词表，正文中高亮
  apiRef?: React.MutableRefObject<ViewerApi | null>
  onWordSelect: (word: string, sentence: string, rect: DOMRect) => void
  onSentenceSelect: (sentence: string, rect: DOMRect) => void
  onRelocated?: (cfi: string, progress: number | null) => void
  onLocationInfo?: (info: LocationInfo) => void
  onToc?: (toc: TocItem[]) => void
  fontSize?: number // 正文字号百分比，100 = 原书原始大小
  fontFamily?: string // CSS font-family 值；空串 = 跟随原书自带字体
}

// 用 epubjs themes 覆盖书自带的字号/字体。priority=true → 加 !important 压过书本身的 CSS。
// 字体空串时移除覆盖，让原书字体生效。
function applyTheme(rendition: EpubRendition, fontSize: number, fontFamily: string) {
  rendition.themes.override('font-size', `${fontSize}%`, true)
  if (fontFamily) rendition.themes.override('font-family', fontFamily, true)
  else rendition.themes.removeOverride('font-family')
}

// 部分书（如古登堡版）含未闭合的无 href 锚点 <a id=".."/>，会把整章正文包成伪链接，
// 叠加书自带的 a:hover{color:red} 后导致鼠标划过全文变红。只压无 href 锚点的 hover 变色，
// 真链接（目录跳转等）的 hover 不受影响。
function applyDefaults(rendition: EpubRendition) {
  rendition.themes.default({
    'a:not([href]):hover': { color: 'inherit !important' },
  })
}

// 从选区所在文本块中提取包含该选区的完整句子
function extractSentence(range: Range): string {
  const node = range.startContainer
  const block = (node.parentElement ?? (node as Element))?.closest?.(
    'p, li, blockquote, h1, h2, h3, h4, td, div'
  )
  if (!block) return ''

  let offset = 0
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let cur: Node | null
  while ((cur = walker.nextNode())) {
    if (cur === node) {
      offset += range.startOffset
      break
    }
    offset += cur.textContent?.length ?? 0
  }

  const text = block.textContent ?? ''
  let start = 0
  for (let i = offset - 2; i >= 0; i--) {
    if (/[.!?]/.test(text[i]) && /[\s"'”’)\]]/.test(text[i + 1] ?? ' ')) {
      start = i + 1
      break
    }
  }
  let end = text.length
  for (let i = offset; i < text.length - 1; i++) {
    if (/[.!?]/.test(text[i]) && /[\s"'”’)\]]/.test(text[i + 1] ?? ' ')) {
      end = i + 1
      break
    }
  }
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

// 在已渲染章节文档中给生词加淡色高亮（幂等：跳过已包裹的节点）
function applyHighlights(doc: Document, words: Set<string>) {
  if (!words.size || !doc.body) return
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('.hl-saved, script, style')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const targets: Text[] = []
  let cur: Node | null
  while ((cur = walker.nextNode())) targets.push(cur as Text)

  const tokenRe = /[A-Za-z][A-Za-z''-]*/g
  for (const textNode of targets) {
    const text = textNode.textContent ?? ''
    let match: RegExpExecArray | null
    const hits: { start: number; end: number }[] = []
    tokenRe.lastIndex = 0
    while ((match = tokenRe.exec(text))) {
      if (words.has(match[0].toLowerCase())) {
        hits.push({ start: match.index, end: match.index + match[0].length })
      }
    }
    if (!hits.length) continue

    const frag = doc.createDocumentFragment()
    let pos = 0
    for (const { start, end } of hits) {
      if (start > pos) frag.appendChild(doc.createTextNode(text.slice(pos, start)))
      const span = doc.createElement('span')
      span.className = 'hl-saved'
      span.textContent = text.slice(start, end)
      span.style.backgroundColor = 'rgba(245, 158, 11, 0.16)'
      span.style.borderBottom = '1px dashed rgba(217, 119, 6, 0.6)'
      span.style.borderRadius = '2px'
      frag.appendChild(span)
      pos = end
    }
    if (pos < text.length) frag.appendChild(doc.createTextNode(text.slice(pos)))
    textNode.parentNode?.replaceChild(frag, textNode)
  }
}

// 扁平化目录树，保留层级深度
function flattenToc(items: NavItem[], depth = 0, out: TocItem[] = []): TocItem[] {
  for (const it of items ?? []) {
    out.push({ label: (it.label ?? '').trim(), href: it.href ?? '', depth })
    if (it.subitems?.length) flattenToc(it.subitems, depth + 1, out)
  }
  return out
}

export default function EpubViewer({
  data,
  initialLocation,
  savedWords,
  apiRef,
  onWordSelect,
  onSentenceSelect,
  onRelocated,
  onLocationInfo,
  onToc,
  fontSize = 100,
  fontFamily = '',
}: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<EpubRendition | null>(null)
  const savedWordsRef = useRef<Set<string>>(new Set(savedWords ?? []))
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const goNext = useCallback(() => renditionRef.current?.next(), [])
  const goPrev = useCallback(() => renditionRef.current?.prev(), [])

  useEffect(() => {
    savedWordsRef.current = new Set(savedWords ?? [])
    const rendition = renditionRef.current
    if (!rendition) return
    for (const contents of rendition.getContents?.() ?? []) {
      applyHighlights(contents.document, savedWordsRef.current)
    }
  }, [savedWords])

  // 字号/字体偏好变化时实时套用到已渲染内容
  useEffect(() => {
    const rendition = renditionRef.current
    if (rendition) applyTheme(rendition, fontSize, fontFamily)
  }, [fontSize, fontFamily])

  useEffect(() => {
    if (!viewerRef.current || typeof window === 'undefined' || !data) return

    let book: Book | undefined
    let initialized = false
    let locationsReady = false
    const hrefLabel = new Map<string, string>()
    // 当前视口顶部位置信息，getCurrent / 添加书签时读取
    const info = { startCfi: '', chapter: '', startPercentage: null as number | null }

    const init = async (width: number, height: number) => {
      const Epub = (await import('epubjs')).default

      const epubBook = Epub(data)
      book = epubBook
      // 安全：不开启 allowScriptedContent，禁止 EPUB 内嵌脚本在阅读器上下文执行
      const rendition = epubBook.renderTo(viewerRef.current!, {
        width,
        height,
        flow: 'scrolled-doc',
      }) as unknown as EpubRendition
      renditionRef.current = rendition

      rendition.hooks.content.register((contents) => {
        applyHighlights(contents.document, savedWordsRef.current)
      })

      // 注入默认防护样式（伪链接 hover 变色），再应用字号/字体偏好（后续章节自动套用）
      applyDefaults(rendition)
      applyTheme(rendition, fontSize, fontFamily)

      await rendition.display(initialLocation || undefined)

      // 目录
      epubBook.loaded.navigation
        .then((nav) => {
          const flat = flattenToc(nav.toc)
          for (const item of flat) {
            const key = item.href.split('#')[0]
            if (key && !hrefLabel.has(key)) hrefLabel.set(key, item.label)
          }
          onToc?.(flat)
        })
        .catch(() => {})

      // 后台生成 locations 以计算进度百分比
      epubBook.ready
        .then(() => epubBook.locations.generate(1600))
        .then(() => {
          locationsReady = true
        })
        .catch(() => {})

      // 暴露命令式 API
      if (apiRef) {
        apiRef.current = {
          goTo: (target: string) => {
            renditionRef.current?.display(target)
          },
          getCurrent: () => {
            if (!info.startCfi) return null
            let excerpt = ''
            try {
              const contents = renditionRef.current?.getContents?.()[0]
              if (contents) {
                const range = contents.range(info.startCfi)
                const node = range?.startContainer
                let el = (node?.nodeType === 3 ? node.parentElement : (node as Element))?.closest?.(
                  'p, li, blockquote, h1, h2, h3, h4, div'
                ) as Element | null
                // 从当前块往后累积正文，直到攒够足够长的、可辨认的片段
                // （章节开头视口顶部常是章节号/标题，单独看认不出）
                let acc = ''
                let steps = 0
                while (el && acc.length < 40 && steps < 8) {
                  const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
                  if (t) acc = acc ? `${acc} ${t}` : t
                  el = el.nextElementSibling
                  steps++
                }
                excerpt = acc.slice(0, 90)
              }
            } catch {
              // 取不到片段就只用章节名
            }
            return {
              cfi: info.startCfi,
              chapter: info.chapter,
              excerpt,
              percentage: info.startPercentage,
            }
          },
        }
      }

      rendition.on('relocated', (loc) => {
        const location = loc as EpubLocation
        setCanPrev(!location.atStart)
        setCanNext(!location.atEnd)

        const startCfi = location.start?.cfi ?? ''
        const href = (location.start?.href ?? '').split('#')[0]
        const chapter = hrefLabel.get(href) ?? ''
        const startPct = locationsReady ? epubBook.locations.percentageFromCfi(startCfi) : null
        const endPct = locationsReady ? epubBook.locations.percentageFromCfi(location.end?.cfi ?? '') : null

        info.startCfi = startCfi
        info.chapter = chapter
        info.startPercentage = startPct

        if (startCfi && onRelocated) onRelocated(startCfi, startPct)
        onLocationInfo?.({ startCfi, chapter, href, startPercentage: startPct, endPercentage: endPct })
      })

      let sentenceTimer: ReturnType<typeof setTimeout> | null = null

      rendition.on('selected', (_cfiRange, c) => {
        const contents = c as EpubContents
        const selection = contents.window.getSelection()
        const text = selection?.toString().trim()
        if (!text || text.length < 2) return

        const range = selection?.getRangeAt(0)
        const innerRect = range?.getBoundingClientRect()
        if (!innerRect || !range) return

        const iframe = viewerRef.current?.querySelector('iframe')
        const iframeRect = iframe?.getBoundingClientRect()
        const rect = new DOMRect(
          (iframeRect?.left ?? 0) + innerRect.left,
          (iframeRect?.top ?? 0) + innerRect.top,
          innerRect.width,
          innerRect.height,
        )

        const wordCount = text.trim().split(/\s+/).length
        if (wordCount <= 2) {
          const sentence = extractSentence(range)
          onWordSelect(text, sentence, rect)
        } else {
          if (sentenceTimer) clearTimeout(sentenceTimer)
          sentenceTimer = setTimeout(() => {
            onSentenceSelect(text, rect)
          }, 600)
        }
      })
    }

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        if (!initialized) {
          initialized = true
          init(width, height).catch(console.error)
        } else if (renditionRef.current) {
          renditionRef.current.resize(width, height)
        }
      }
    })
    ro.observe(viewerRef.current)

    return () => {
      ro?.disconnect()
      renditionRef.current = null
      if (apiRef) apiRef.current = null
      if (book) book.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, onWordSelect, onSentenceSelect])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  return (
    <div className="relative w-full h-full">
      <div
        ref={viewerRef}
        className="w-full h-full"
        style={{ fontFamily: 'Georgia, serif' }}
      />

      {/* 上一章 */}
      {canPrev && (
        <button
          onClick={goPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow text-amber-700 hover:text-amber-900 transition-all"
          aria-label="上一章"
        >
          ‹
        </button>
      )}

      {/* 下一章 */}
      {canNext && (
        <button
          onClick={goNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow text-amber-700 hover:text-amber-900 transition-all"
          aria-label="下一章"
        >
          ›
        </button>
      )}
    </div>
  )
}
