'use client'

import { useState } from 'react'
import { getApiKey, setApiKey, clearApiKey } from '@/lib/api-key'

interface ApiKeyDialogProps {
  open: boolean
  // 是否允许关闭（首次没填 key 时设为 false，逼用户先配置）
  dismissable?: boolean
  onClose: () => void
}

export default function ApiKeyDialog({ open, dismissable = true, onClose }: ApiKeyDialogProps) {
  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)

  // 打开瞬间把已存 key 读进表单。用「渲染期按 open 变化调整 state」的官方模式，
  // 避免在 effect 里 setState。
  if (open && !wasOpen) {
    setWasOpen(true)
    setValue(getApiKey())
    setReveal(false)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  if (!open) return null

  const save = () => {
    if (!value.trim()) return
    setApiKey(value)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => dismissable && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-amber-900">配置 DeepSeek API Key</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          查词和句子拆解需要调用 DeepSeek。请填入你自己的 API Key——它只保存在你本地浏览器，
          仅在调用时由你的浏览器直接发送给 DeepSeek 官方接口，不经过本应用的任何服务器。
        </p>

        <div className="mt-4 relative">
          <input
            type={reveal ? 'text' : 'password'}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="sk-..."
            autoFocus
            className="w-full rounded-lg border border-amber-200 px-3 py-2 pr-16 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-500 hover:text-amber-700"
          >
            {reveal ? '隐藏' : '显示'}
          </button>
        </div>

        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-amber-600 hover:text-amber-800 underline"
        >
          还没有 key？去 DeepSeek 平台申请 →
        </a>

        <div className="mt-5 flex items-center justify-between gap-3">
          {getApiKey() ? (
            <button
              onClick={() => {
                clearApiKey()
                setValue('')
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              清除已存 key
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {dismissable && (
              <button
                onClick={onClose}
                className="rounded-full px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {getApiKey() ? '取消' : '先逛逛 →'}
              </button>
            )}
            <button
              onClick={save}
              disabled={!value.trim()}
              className="rounded-full bg-amber-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
