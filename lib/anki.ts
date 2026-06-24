// Anki 文本导入工具：把生词 / 句子导出成 Anki 能直接识别的制表符分隔文本。
// 用 Tab 分隔（例句里常有逗号，CSV 会错列）；文件头声明分隔符、允许 HTML、列名。
import type { SavedWord, SavedSentence, AnalysisResult } from '@/types'

// 把字段里可能干扰 TSV / HTML 的字符处理干净
function escapeField(text: string): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\t/g, ' ')
    // 三种换行（CRLF / 单独 CR / LF）都转成 <br>，避免单独的 \r 把字段截断错行
    .replace(/\r\n|\r|\n/g, '<br>')
    .trim()
}

function buildFile(rows: string[]): string {
  const header = ['#separator:tab', '#html:true', '#columns:Front\tBack'].join('\n')
  return `${header}\n${rows.join('\n')}\n`
}

// 运行时校验 analysis：AI 接口结果可能缺字段/损坏，取不到就当空，不让整次导出崩溃
function safeAnalysis(a: unknown): AnalysisResult {
  const o = (a && typeof a === 'object' ? a : {}) as Partial<AnalysisResult>
  const phrases = Array.isArray(o.phrases)
    ? o.phrases.filter(
        (p): p is { phrase: string; meaning: string } =>
          !!p && typeof p === 'object' && typeof p.phrase === 'string' && typeof p.meaning === 'string'
      )
    : []
  return {
    structure: typeof o.structure === 'string' ? o.structure : '',
    phrases,
    notes: typeof o.notes === 'string' ? o.notes : '',
    translation: typeof o.translation === 'string' ? o.translation : '',
  }
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// 生词卡行：正面=单词，背面=释义 + 例句 + 出处。空 front 用 word 兜底，仍为空则跳过。
function wordRows(words: SavedWord[]): string[] {
  const rows: string[] = []
  for (const w of words) {
    const front = escapeField(w.display || w.word)
    if (!front) continue // 正面为空会生成无效卡片，Anki 按首字段去重会乱，直接跳过
    const back = [escapeField(w.meaning)]
    if (w.sentence) back.push(`<br><br><i>${escapeField(w.sentence)}</i>`)
    if (w.bookTitle) back.push(`<br><span style="color:#999;font-size:0.85em">— ${escapeField(w.bookTitle)}</span>`)
    rows.push(`${front}\t${back.join('')}`)
  }
  return rows
}

// 句子卡行：正面=英文原句，背面=翻译 + 句子结构 + 关键短语 + 笔记 + 出处。
// analysis 做运行时兜底，缺字段不抛错；front 为空则跳过该句。
function sentenceRows(sentences: SavedSentence[]): string[] {
  const rows: string[] = []
  for (const s of sentences) {
    const front = escapeField(s.sentence)
    if (!front) continue // 句子为空跳过
    const a = safeAnalysis(s.analysis)
    const back: string[] = []
    if (a.translation) back.push(`<b>${escapeField(a.translation)}</b>`)
    if (a.structure) back.push(`<br><br><b>句子结构</b><br>${escapeField(a.structure)}`)
    if (a.phrases.length > 0) {
      const items = a.phrases
        .map(p => `${escapeField(p.phrase)} — ${escapeField(p.meaning)}`)
        .join('<br>')
      back.push(`<br><br><b>关键短语</b><br>${items}`)
    }
    if (a.notes) back.push(`<br><br><b>笔记</b><br>${escapeField(a.notes)}`)
    if (s.bookTitle) back.push(`<br><br><span style="color:#999;font-size:0.85em">— ${escapeField(s.bookTitle)}</span>`)
    rows.push(`${front}\t${back.join('')}`)
  }
  return rows
}

// 仅导出生词（生词本面板用）：单文件，一次下载
export function exportWordsToAnki(words: SavedWord[]) {
  const rows = wordRows(words)
  if (rows.length === 0) return
  download(buildFile(rows), `生词本-anki-${today()}.txt`)
}

// 单文件合并导出：生词区块 + 句子区块写进同一个 .txt，共用 Front/Back 两列结构。
// 只触发一次下载，避免连发两个下载时第二个因用户激活态丢失被浏览器拦截。
export function exportAllToAnki(words: SavedWord[], sentences: SavedSentence[]) {
  const rows = [...wordRows(words), ...sentenceRows(sentences)]
  if (rows.length === 0) return
  download(buildFile(rows), `阅读笔记-anki-${today()}.txt`)
}
