import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import type { AnalysisResult } from '@/types'

// 只认前端传来的用户 key（header）。不再回退服务端环境变量，
// 避免公开部署后被人当成免费的 DeepSeek 代理白嫖额度。
function getClient(req: NextRequest): OpenAI | null {
  const apiKey = req.headers.get('x-deepseek-key')?.trim()
  if (!apiKey) return null
  return new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' })
}

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

export async function POST(req: NextRequest) {
  const client = getClient(req)
  if (!client) return NextResponse.json({ error: 'no_key' }, { status: 401 })

  let sentence: string | undefined
  try {
    const body = await req.json()
    sentence = typeof body?.sentence === 'string' ? body.sentence : undefined
  } catch {
    return NextResponse.json({ ...EMPTY, error: 'bad_request' }, { status: 400 })
  }
  if (!sentence) return NextResponse.json(EMPTY, { status: 400 })

  let text = ''
  try {
    const res = await client.chat.completions.create({
      model: 'deepseek-chat',
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
    })
    text = res.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return NextResponse.json({ ...EMPTY, error: 'upstream_failed' }, { status: 502 })
  }

  const parsed = parseAnalysis(text)

  // 解析失败时，至少把内容放进 notes 而不是污染翻译字段
  return NextResponse.json(parsed ?? { ...EMPTY, notes: '解析失败，请重试这句' })
}
