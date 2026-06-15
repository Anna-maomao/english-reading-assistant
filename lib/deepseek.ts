// 浏览器直连 DeepSeek：用 localStorage 里的用户 key 直接打 DeepSeek 官方接口，
// 不经过自己的后端，避免公开部署后被人当成免费的 DeepSeek 代理白嫖额度。

import type { AnalysisResult } from '@/types'
import { getApiKey } from './api-key'

const ENDPOINT = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'

const EMPTY: AnalysisResult = { structure: '', phrases: [], notes: '', translation: '' }

// 容错解析：剥掉 markdown 代码块、只截取最外层 JSON 对象后再解析
function parseAnalysis(raw: string): AnalysisResult | null {
  let t = raw.trim()
  // 去掉 ```json ... ``` 或 ``` ... ``` 包裹
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  // 截取第一个 { 到最后一个 }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first !== -1 && last > first) t = t.slice(first, last + 1)

  try {
    const obj = JSON.parse(t)
    return {
      structure: typeof obj.structure === 'string' ? obj.structure : '',
      phrases: Array.isArray(obj.phrases)
        ? obj.phrases
            .filter((p: unknown): p is { phrase: string; meaning: string } =>
              !!p && typeof (p as { phrase?: unknown }).phrase === 'string'
            )
            .map((p: { phrase: string; meaning?: string }) => ({
              phrase: p.phrase,
              meaning: typeof p.meaning === 'string' ? p.meaning : '',
            }))
        : [],
      notes: typeof obj.notes === 'string' ? obj.notes : '',
      translation: typeof obj.translation === 'string' ? obj.translation : '',
    }
  } catch {
    return null
  }
}

// 查词：有句子用语境版，无句子用常用义版。失败/无 key 不抛异常，统一走返回值。
export async function lookupWord(
  word: string,
  sentence: string
): Promise<{ meaning: string; error?: string }> {
  const apiKey = getApiKey().trim()
  if (!apiKey) return { meaning: '', error: 'no_key' }

  const prompt = sentence
    ? `句子："${sentence}"\n其中"${word}"在这句话里的中文意思是什么？只输出中文释义，不超过10个字。如有一词多义，只给本句中的含义。`
    : `英文单词"${word}"最常用的中文意思，只输出中文，不超过10个字。`

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 40,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { meaning: '', error: 'upstream_failed' }
    const data = await res.json()
    const meaning = data?.choices?.[0]?.message?.content?.trim() ?? ''
    return { meaning }
  } catch {
    return { meaning: '', error: 'upstream_failed' }
  }
}

// 拆句：system + user 两条 message，强制 JSON 输出。解析失败回落到 notes 提示。
export async function analyzeSentence(
  sentence: string
): Promise<{ result: AnalysisResult | null; error?: string }> {
  const apiKey = getApiKey().trim()
  if (!apiKey) return { result: null, error: 'no_key' }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: '你是英语语法教师，帮助中国学习者理解英语句子结构。只输出 JSON 对象，不要 markdown 代码块、不要多余文字。',
          },
          {
            role: 'user',
            content: `分析这个英语句子（忽略句中可能出现的脚注数字）：
"${sentence}"

严格按这个 JSON 格式输出：
{"structure":"句子结构（标出主语/谓语/宾语/从句等）","phrases":[{"phrase":"短语","meaning":"中文"}],"notes":"难点说明，无则空字符串","translation":"中文翻译"}`,
          },
        ],
      }),
    })
    if (!res.ok) return { result: null, error: 'upstream_failed' }
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim() ?? ''
    const parsed = parseAnalysis(text)
    // 解析失败时，至少把内容放进 notes 而不是污染翻译字段
    return { result: parsed ?? { ...EMPTY, notes: '解析失败，请重试这句' } }
  } catch {
    return { result: null, error: 'upstream_failed' }
  }
}
