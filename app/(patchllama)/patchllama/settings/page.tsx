/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

'use client'

import { useEffect, useState } from 'react'

type Status = {
  ok: boolean
  configured: boolean
  demoMode?: boolean
  model?: string
  baseUrl?: string
  message?: string
  preview?: string
}

export default function PatchllamaSettingsPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/patchllama/meta/status')
      setStatus(await response.json())
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <main className='pl-main'>
      <h1 style={{ marginTop: 0 }}>Settings · Meta Model API</h1>
      <p className='pl-muted'>
        PatchLlama uses Muse Spark only (`MODEL_API_KEY` → `https://api.meta.ai/v1`). It never silently
        switches to OpenAI, Claude, or Gemini.
      </p>
      {!status?.configured ? (
        <div className='pl-banner-demo'>
          MODEL_API_KEY is unset. Demo/mock mode is active and must be labeled as such in the UI.
        </div>
      ) : null}
      <div className='pl-card'>
        <p>
          <span className='pl-muted'>Configured:</span> {status?.configured ? 'yes' : 'no'}
        </p>
        <p>
          <span className='pl-muted'>Model:</span> {status?.model || '—'}
        </p>
        <p>
          <span className='pl-muted'>Base URL:</span> {status?.baseUrl || '—'}
        </p>
        <p>
          <span className='pl-muted'>Status:</span> {status?.message || '…'}
        </p>
        {status?.preview ? (
          <p className='pl-code' style={{ marginTop: '1rem' }}>
            ping preview: {status.preview}
          </p>
        ) : null}
        <button className='pl-btn pl-btn-primary' type='button' disabled={busy} onClick={() => void refresh()}>
          {busy ? 'Testing…' : 'Test connection'}
        </button>
      </div>
      <div className='pl-card' style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Required environment variables</h3>
        <pre className='pl-code'>{`MODEL_API_KEY=LLM_...
MODEL_API_BASE_URL=https://api.meta.ai/v1
MODEL_NAME=muse-spark-1.3
MODEL_TIMEOUT_SECONDS=60
MODEL_MAX_OUTPUT_TOKENS=4096
PATCHLLAMA_MAX_REPAIR_ATTEMPTS=2`}</pre>
      </div>
    </main>
  )
}
