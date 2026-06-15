import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

// 只认前端传来的用户 key（header）。不再回退服务端环境变量，
// 避免公开部署后被人当成免费的 DeepSeek 代理白嫖额度。
function getClient(req: NextRequest): OpenAI | null {
  const apiKey = req.headers.get('x-deepseek-key')?.trim()
  if (!apiKey) return null
  return new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' })
}

export async function POST(req: NextRequest) {
  const client = getClient(req)
  if (!client) return NextResponse.json({ meaning: '', error: 'no_key' }, { status: 401 })

  let word: string | undefined
  let sentence: string | undefined
  try {
    const body = await req.json()
    word = typeof body?.word === 'string' ? body.word : undefined
    sentence = typeof body?.sentence === 'string' ? body.sentence : undefined
  } catch {
    return NextResponse.json({ meaning: '', error: 'bad_request' }, { status: 400 })
  }
  if (!word) return NextResponse.json({ meaning: '' }, { status: 400 })

  const prompt = sentence
    ? `句子："${sentence}"\n其中"${word}"在这句话里的中文意思是什么？只输出中文释义，不超过10个字。如有一词多义，只给本句中的含义。`
    : `英文单词"${word}"最常用的中文意思，只输出中文，不超过10个字。`

  try {
    const res = await client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 40,
      messages: [{ role: 'user', content: prompt }],
    })
    const meaning = res.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ meaning })
  } catch {
    return NextResponse.json({ meaning: '', error: 'upstream_failed' }, { status: 502 })
  }
}
