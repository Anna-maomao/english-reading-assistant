'use client'

// DeepSeek API Key 管理：只存在用户本地浏览器（localStorage），
// 每次请求带在 header 里转发给自己的后端，后端再转给 DeepSeek。
// 不上传到任何第三方服务器，clone 本项目的人各填各的 key。

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'deepseek_api_key'
const EVENT = 'apikey-change'

export function getApiKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export function setApiKey(value: string) {
  localStorage.setItem(STORAGE_KEY, value.trim())
  window.dispatchEvent(new Event(EVENT))
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(EVENT))
}

// 给 fetch 用：把 key 塞进请求头（没填则返回空对象）
export function apiKeyHeader(): Record<string, string> {
  const key = getApiKey()
  return key ? { 'x-deepseek-key': key } : {}
}

// 订阅 key 的变化（本标签页用自定义事件，跨标签页用 storage 事件）
export function useApiKey(): string {
  const [key, setKey] = useState('')
  useEffect(() => {
    const sync = () => setKey(getApiKey())
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return key
}
