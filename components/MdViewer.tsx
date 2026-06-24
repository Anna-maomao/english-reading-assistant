'use client'

import { useEffect, useRef } from 'react'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import type { TocItem } from '@/types'
import type { ViewerApi, LocationInfo } from './EpubViewer'

// 仅允许 http(s)、mailto、tel 与相对链接；明确封禁 data:/javascript: 等危险协议
const SAFE_URI_RE = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i
// 图片只允许 http(s) 与相对路径，data: URI 一律禁（DOMPurify 默认会放行 data:image，这里在解析层堵死）
const SAFE_IMG_RE = /^(?:https?:\/\/|\/|\.{0,2}\/|[^/:]+(?:[/?#]|$))/i

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 专用 marked 实例：在解析层丢弃所有原始 HTML（block 的 html token 与 inline 的 tag token
// 都走 renderer.html），从源头切断内嵌 <script>/<svg>/<iframe>/<img onerror> 等注入面。
const md = new Marked({
  gfm: true,
  breaks: false,
  async: false,
  renderer: {
    // raw HTML 一律输出空串，绝不进入 DOM
    html() {
      return ''
    },
    // markdown 图片：src 不安全（data:/javascript: 等）则降级为 alt 文本，不生成 <img>
    image({ href, title, text }) {
      if (!SAFE_IMG_RE.test((href ?? '').trim())) return escapeHtml(text ?? '')
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? '')}"${titleAttr}>`
    },
  },
})

interface MdViewerProps {
  data: ArrayBuffer | null
  initialLocation?: string | null // `scroll:<0-1>`
  savedWords?: string[]
  apiRef?: React.MutableRefObject<ViewerApi | null>
  onWordSelect: (word: string, sentence: string, rect: DOMRect) => void
  onSentenceSelect: (sentence: string, rect: DOMRect) => void
  onRelocated?: (cfi: string, progress: number | null) => void
  onLocationInfo?: (info: LocationInfo) => void
  onToc?: (toc: TocItem[]) => void
  fontSize?: number // 正文字号百分比，100 = 默认
  fontFamily?: string // CSS font-family 值；空串 = 默认衬线
}

// 解析续读/书签定位字符串 `scroll:<0-1>` → 百分比，越界裁剪到 [0,1]
function parseScroll(loc: string | null | undefined): number | null {
  if (!loc) return null
  const m = /^scroll:([0-9]*\.?[0-9]+)$/.exec(loc)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  return Math.min(1, Math.max(0, n))
}

// 从选区所在文本块中提取包含该选区的完整句子（参照 EpubViewer，块级元素为界）
function extractSentence(range: Range): string {
  const node = range.startContainer
  const block = (node.nodeType === 3 ? node.parentElement : (node as Element))?.closest?.(
    'p, li, blockquote, h1, h2, h3, h4, h5, h6, td, div'
  )
  if (!block) return (node.textContent ?? '').replace(/\s+/g, ' ').trim()

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

// 先剥掉所有已有高亮包裹，把文本还原回去（供删词后重建用）
function unwrapHighlights(root: HTMLElement) {
  const doc = root.ownerDocument
  const spans = Array.from(root.querySelectorAll('span.hl-saved'))
  for (const span of spans) {
    const parent = span.parentNode
    if (!parent) continue
    parent.replaceChild(doc.createTextNode(span.textContent ?? ''), span)
    // 合并相邻文本节点，避免 token 被切断导致下次匹配漏命中
    parent.normalize()
  }
}

// 在容器中给生词加淡色高亮（先清旧高亮再按最新词表重建，保证删词后旧高亮消失）
function applyHighlights(root: HTMLElement, words: Set<string>) {
  unwrapHighlights(root)
  if (!words.size) return
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      // 不动已高亮、代码、脚本/样式残留里的文本
      if (parent.closest('.hl-saved, code, pre, script, style')) return NodeFilter.FILTER_REJECT
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

export default function MdViewer({
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
}: MdViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const savedWordsRef = useRef<Set<string>>(new Set(savedWords ?? []))
  // 升序标题列表（offsetTop + 文本 + id），用于「当前章节」「目录高亮」「书签摘要」
  const headingsRef = useRef<{ id: string; text: string; top: number }[]>([])

  // 回调放进 ref，避免身份变化触发整篇重渲染（在 effect 中更新，不在渲染期写 ref）
  const cbRef = useRef({ onWordSelect, onSentenceSelect, onRelocated, onLocationInfo, onToc })
  useEffect(() => {
    cbRef.current = { onWordSelect, onSentenceSelect, onRelocated, onLocationInfo, onToc }
  })

  // 生词表变化时，对已渲染内容补高亮（内容不重建，仅幂等加高亮）
  useEffect(() => {
    savedWordsRef.current = new Set(savedWords ?? [])
    if (contentRef.current) applyHighlights(contentRef.current, savedWordsRef.current)
  }, [savedWords])

  // 主流程：解析 → 净化 → 注入 → 目录/续读/进度/选区
  useEffect(() => {
    if (!scrollRef.current || !contentRef.current || typeof window === 'undefined' || !data) return

    const scroller = scrollRef.current
    const content = contentRef.current
    let rafId = 0 // 滚动节流 rAF
    let initRafId = 0 // 续读初始化定位 rAF（单独存，cleanup 要取消）
    let sentenceTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    // 1. 解码 + 解析（已在解析层丢弃原始 HTML）+ 二次净化（纵深防御）
    const text = new TextDecoder('utf-8').decode(data)
    const rawHtml = md.parse(text) as string
    const clean = DOMPurify.sanitize(rawHtml, {
      // 只允许标准 HTML 命名空间，关掉 SVG / MathML（mXSS 高发区）。
      USE_PROFILES: { html: true },
      // 显式封禁可执行/可注入标签（纵深防御，解析层已丢 HTML，这里再兜一层）。
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'base', 'svg', 'math'],
      // 禁内联 style，杜绝 CSS 注入面。
      FORBID_ATTR: ['style'],
      ALLOW_DATA_ATTR: false,
      // 链接协议收紧到 http(s)/mailto/tel/相对链接，明确封禁 data:、javascript: 等。
      ALLOWED_URI_REGEXP: SAFE_URI_RE,
      ADD_ATTR: ['target', 'rel'],
    })
    content.innerHTML = clean

    // 2. 给标题加稳定 id + 生成目录
    const hs = Array.from(content.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
    const toc: TocItem[] = []
    hs.forEach((h, i) => {
      const id = `md-h-${i}`
      h.id = id
      const label = (h.textContent ?? '').trim()
      const depth = Number(h.tagName.slice(1)) - 1
      toc.push({ label, href: `#${id}`, depth })
    })
    cbRef.current.onToc?.(toc)

    // 3. 链接安全：外链新窗口打开并断引用
    for (const a of Array.from(content.querySelectorAll('a[href]')) as HTMLAnchorElement[]) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }

    // 4. 高亮已存生词
    applyHighlights(content, savedWordsRef.current)

    // 缓存标题位置，供 chapterOf / 目录高亮使用
    const rebuildHeadings = () => {
      headingsRef.current = hs.map(h => ({
        id: h.id,
        text: (h.textContent ?? '').trim(),
        top: h.offsetTop,
      }))
    }
    rebuildHeadings()

    const maxScroll = () => Math.max(1, scroller.scrollHeight - scroller.clientHeight)
    const currentPct = () => Math.min(1, Math.max(0, scroller.scrollTop / maxScroll()))

    // 当前视口顶部所在标题
    const chapterOf = (): { text: string; id: string } => {
      const top = scroller.scrollTop + 4
      let cur = { text: '', id: '' }
      for (const h of headingsRef.current) {
        if (h.top <= top) cur = { text: h.text, id: h.id }
        else break
      }
      return cur
    }

    const emitLocation = () => {
      const pct = currentPct()
      const cfi = `scroll:${pct.toFixed(4)}`
      const ch = chapterOf()
      cbRef.current.onRelocated?.(cfi, pct)
      cbRef.current.onLocationInfo?.({
        startCfi: cfi,
        chapter: ch.text,
        href: ch.id ? `#${ch.id}` : '',
        startPercentage: pct,
        endPercentage: pct,
      })
    }

    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        emitLocation()
      })
    }

    // 5. 命令式 API
    if (apiRef) {
      apiRef.current = {
        goTo: (target: string) => {
          if (target.startsWith('#')) {
            // 用 getElementById 避免书签里非法 id 传入 querySelector 抛异常
            const el = content.ownerDocument.getElementById(target.slice(1))
            if (el && content.contains(el)) scroller.scrollTop = el.offsetTop - 8
            return
          }
          const pct = parseScroll(target)
          if (pct != null) scroller.scrollTop = pct * maxScroll()
        },
        getCurrent: () => {
          const pct = currentPct()
          const ch = chapterOf()
          // 取视口顶部往后的正文片段作为书签摘要
          const top = scroller.scrollTop
          let excerpt = ''
          const blocks = Array.from(
            content.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6')
          ) as HTMLElement[]
          for (const b of blocks) {
            if (b.offsetTop + b.offsetHeight < top) continue
            const t = (b.textContent ?? '').replace(/\s+/g, ' ').trim()
            if (t) {
              excerpt = excerpt ? `${excerpt} ${t}` : t
              if (excerpt.length >= 40) break
            }
          }
          return {
            cfi: `scroll:${pct.toFixed(4)}`,
            chapter: ch.text,
            excerpt: excerpt.slice(0, 90),
            percentage: pct,
          }
        },
      }
    }

    // 6. 续读定位（等布局稳定后再设置滚动位置）
    const startPct = parseScroll(initialLocation)
    initRafId = requestAnimationFrame(() => {
      initRafId = 0
      if (cancelled) return
      rebuildHeadings()
      if (startPct != null && startPct > 0) {
        scroller.scrollTop = startPct * maxScroll()
      }
      emitLocation()
    })

    // 布局变化（图片加载、字号/字体切换、窗口缩放）后标题 offsetTop 会变，需重建缓存
    const ro = new ResizeObserver(() => {
      if (cancelled) return
      rebuildHeadings()
    })
    ro.observe(content)
    // 图片懒加载完成会改变后续标题位置，逐张监听 load/error 后重建
    const imgs = Array.from(content.querySelectorAll('img')) as HTMLImageElement[]
    const onImgSettled = () => {
      if (!cancelled) rebuildHeadings()
    }
    for (const img of imgs) {
      if (img.complete) continue
      img.addEventListener('load', onImgSettled)
      img.addEventListener('error', onImgSettled)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })

    // 7. 选区 → 查词 / 拆句（参照 PdfViewer 的 onPointerUp）
    const onPointerUp = () => {
      const sel = scroller.ownerDocument.getSelection()
      const text = sel?.toString().trim()
      if (!sel || !text || text.length < 2) return
      const range = sel.getRangeAt(0)
      if (!content.contains(range.commonAncestorContainer)) return
      const rect = range.getBoundingClientRect()
      if (!rect.width && !rect.height) return

      const wordCount = text.split(/\s+/).length
      if (wordCount <= 2) {
        const sentence = extractSentence(range)
        cbRef.current.onWordSelect(text, sentence, rect)
      } else {
        if (sentenceTimer) clearTimeout(sentenceTimer)
        sentenceTimer = setTimeout(() => cbRef.current.onSentenceSelect(text, rect), 600)
      }
    }
    scroller.addEventListener('pointerup', onPointerUp)

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      if (initRafId) cancelAnimationFrame(initRafId)
      if (sentenceTimer) clearTimeout(sentenceTimer)
      ro.disconnect()
      for (const img of imgs) {
        img.removeEventListener('load', onImgSettled)
        img.removeEventListener('error', onImgSettled)
      }
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('pointerup', onPointerUp)
      if (apiRef) apiRef.current = null
      headingsRef.current = []
      content.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return (
    <div ref={scrollRef} className="w-full h-full overflow-auto bg-[#F7F2E9]">
      <div
        ref={contentRef}
        className="md-content max-w-2xl mx-auto px-6 py-10"
        style={{
          fontSize: `${fontSize}%`,
          fontFamily: fontFamily || 'Georgia, "Times New Roman", serif',
        }}
      />
    </div>
  )
}
