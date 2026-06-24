// 从 Markdown(.md) 文件中提取标题。.md 是纯文本，无内嵌封面/作者，
// 故 cover 恒为 null、author 恒为空串。标题取首个 ATX 一级标题（行首 `# `）；
// 取不到时返回空串，由调用方用「去扩展名的文件名」兜底。

export function extractMdMeta(buffer: ArrayBuffer): {
  title: string
  author: string
  cover: Blob | null
} {
  let text = ''
  try {
    text = new TextDecoder('utf-8').decode(buffer)
  } catch {
    // 解码失败就交给文件名兜底
    return { title: '', author: '', cover: null }
  }

  let title = ''
  // 跟踪 fenced code block 状态：``` 或 ~~~ 围栏内的 `# Fake` 不是标题
  let fence: string | null = null // 当前围栏字符（``` 或 ~~~），null 表示在围栏外
  for (const rawLine of text.split(/\r?\n/)) {
    // 围栏开/闭：行首 0-3 空格 + 至少 3 个 ` 或 ~（CommonMark）
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(rawLine)
    if (fenceMatch) {
      const marker = fenceMatch[1][0] // '`' 或 '~'
      if (fence === null) {
        fence = marker // 开围栏
      } else if (marker === fence) {
        fence = null // 闭围栏（须同种字符）
      }
      continue
    }
    if (fence !== null) continue // 在代码块内，跳过

    // ATX 一级标题：行首 0-3 空格 + 单个 # + 空格（排除 ## 以上）
    const m = /^ {0,3}#[ \t]+(.+?)[ \t]*#*$/.exec(rawLine)
    if (m) {
      title = m[1].trim()
      break
    }
  }

  return { title, author: '', cover: null }
}
