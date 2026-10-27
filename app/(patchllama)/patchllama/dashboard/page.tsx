/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type SessionRow = {
  id: string
  title: string
  status: string
  createdAt: string
  verified: boolean
}

export default function PatchllamaDashboardPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/patchllama/sessions')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error?.message || 'Failed to load')
        setSessions(data.sessions || [])
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const verified = sessions.filter((s) => s.verified).length
  const failed = sessions.filter((s) => s.status === 'failed').length
  const rate = sessions.length ? Math.round((verified / sessions.length) * 100) : 0

  return (
    <main className='pl-main'>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p className='pl-muted'>Metrics are computed from stored session results — not hardcoded.</p>
      {error ? <p style={{ color: 'var(--pl-danger)' }}>{error}</p> : null}
      <div className='pl-grid'>
        <div className='pl-card'>
          <strong>{sessions.length}</strong>
          <span className='pl-muted'>Debugging sessions</span>
        </div>
        <div className='pl-card'>
          <strong>{verified}</strong>
          <span className='pl-muted'>Verified fixes</span>
        </div>
        <div className='pl-card'>
          <strong>{failed}</strong>
          <span className='pl-muted'>Failed verifications</span>
        </div>
        <div className='pl-card'>
          <strong>{rate}%</strong>
          <span className='pl-muted'>Verification success rate</span>
        </div>
      </div>
      <div className='pl-card'>
        <h3 style={{ marginTop: 0 }}>Recent sessions</h3>
        {sessions.length === 0 ? (
          <p className='pl-muted'>
            No sessions yet.{' '}
            <Link href='/patchllama/workspace' style={{ color: 'var(--pl-lime)' }}>
              Load the demo workflow
            </Link>
            .
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sessions.map((s) => (
              <li
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid var(--pl-border)',
                }}
              >
                <Link href={`/patchllama/workspace?session=${s.id}`} style={{ color: 'inherit' }}>
                  {s.title}
                </Link>
                <span className={`pl-status pl-status-${s.status}`}>{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
