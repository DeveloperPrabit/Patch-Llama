/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama debugging workspace
 */

'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Session = {
  id: string
  status: string
  intake: { title: string; command: string; stderr: string; stdout: string }
  diagnosis?: {
    problem_summary: string
    likely_root_cause: string
    confidence: number
    source: string
    model?: string
    evidence: Array<{ kind: string; summary: string }>
    proposed_minimal_fix: string
  }
  patches: Array<{
    id: string
    status: string
    source: string
    proposal: {
      summary: string
      rationale: string
      unified_diff?: string
      files: Array<{ path: string; description: string; content: string }>
      verification_commands: string[]
    }
  }>
  executions: Array<{
    command: string
    exitCode: number | null
    ok: boolean
    stdout: string
    stderr: string
    durationMs: number
  }>
  files: Array<{ path: string; content: string }>
  audit: Array<{ type: string; detail: string; ts: string }>
}

function WorkspaceInner() {
  const search = useSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Record<string, unknown> | null>(null)

  const loadSession = useCallback(async (id: string) => {
    const response = await fetch(`/api/patchllama/sessions/${id}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || 'Load failed')
    setSession(data.session)
    setSelectedFile(data.session.files?.[0]?.path || null)
  }, [])

  useEffect(() => {
    const id = search.get('session')
    if (id) void loadSession(id).catch((e: Error) => setError(e.message))
  }, [search, loadSession])

  const proposed = useMemo(
    () => session?.patches.find((p) => p.status === 'proposed') || session?.patches.at(-1),
    [session]
  )

  const fileContent = session?.files.find((f) => f.path === selectedFile)?.content || ''

  async function ensureAuth() {
    await fetch('/api/auth/demo-login', { method: 'POST' })
  }

  async function runDemo(scenario: string) {
    setBusy('Seeding demo…')
    setError(null)
    setReport(null)
    try {
      await ensureAuth()
      const response = await fetch('/api/patchllama/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, analyze: true, runBaseline: false }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error?.message || 'Demo failed')
      const evidence = data.evidenceSource || data.session?.evidenceSource || 'seeded_fixture'
      setBanner(
        `${data.demoModeLabel || 'Demo'} · evidence=${evidence}` +
          (data.session?.status === 'inconclusive' ? ' · INCONCLUSIVE' : '')
      )
      setSession(data.session)
      setSelectedFile(data.session.files?.[0]?.path || null)
      window.history.replaceState({}, '', `/patchllama/workspace?session=${data.session.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function approve(decision: 'approve' | 'reject') {
    if (!session || !proposed) return
    setBusy(decision === 'approve' ? 'Applying & verifying…' : 'Rejecting…')
    setError(null)
    try {
      await ensureAuth()
      const response = await fetch(
        `/api/patchllama/sessions/${session.id}/patches/${proposed.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error?.message || 'Approve failed')
      setSession(data.session)
      const reportResponse = await fetch(`/api/patchllama/sessions/${session.id}/report`)
      const reportData = await reportResponse.json()
      if (reportResponse.ok) setReport(reportData.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className='pl-workspace'>
      <aside className='pl-panel'>
        <h3>Sessions / files</h3>
        <div className='pl-panel-body'>
          <div className='pl-actions' style={{ marginTop: 0, marginBottom: '0.75rem' }}>
            <button
              className='pl-btn pl-btn-primary'
              type='button'
              disabled={!!busy}
              onClick={() => void runDemo('logic_bug')}
            >
              Demo: logic bug
            </button>
            <button
              className='pl-btn pl-btn-secondary'
              type='button'
              disabled={!!busy}
              onClick={() => void runDemo('bad_patch')}
            >
              Demo: bad patch
            </button>
          </div>
          {session ? (
            <>
              <p className='pl-muted' style={{ marginTop: 0 }}>
                {session.intake.title}
              </p>
              <span className={`pl-status pl-status-${session.status}`}>{session.status}</span>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
                {session.files.map((f) => (
                  <li key={f.path}>
                    <button
                      type='button'
                      onClick={() => setSelectedFile(f.path)}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: selectedFile === f.path ? 'var(--pl-lime)' : 'var(--pl-text)',
                        cursor: 'pointer',
                        padding: '0.25rem 0',
                        textAlign: 'left',
                        width: '100%',
                        fontFamily: 'inherit',
                      }}
                    >
                      {f.path}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className='pl-muted'>Load a demo to start a reproducible debugging session.</p>
          )}
        </div>
      </aside>

      <section className='pl-panel'>
        <h3>Source / evidence / diff</h3>
        <div className='pl-panel-body'>
          {banner ? <div className='pl-banner-demo'>{banner}</div> : null}
          {error ? <p style={{ color: 'var(--pl-danger)' }}>{error}</p> : null}
          {busy ? <p className='pl-muted'>{busy}</p> : null}
          {proposed?.proposal.unified_diff ? (
            <>
              <p className='pl-muted'>Proposed unified diff</p>
              <pre className='pl-code'>{proposed.proposal.unified_diff}</pre>
            </>
          ) : null}
          {proposed && !proposed.proposal.unified_diff ? (
            <>
              <p className='pl-muted'>Proposed file changes</p>
              {proposed.proposal.files.map((f) => (
                <div key={f.path} style={{ marginBottom: '1rem' }}>
                  <strong>{f.path}</strong> — {f.description}
                  <pre className='pl-code'>{f.content}</pre>
                </div>
              ))}
            </>
          ) : null}
          <p className='pl-muted'>{selectedFile || 'No file selected'}</p>
          <pre className='pl-code'>{fileContent || session?.intake.stderr || '—'}</pre>
        </div>
      </section>

      <aside className='pl-panel'>
        <h3>AI diagnosis</h3>
        <div className='pl-panel-body'>
          {session?.diagnosis ? (
            <>
              <p>
                <span
                  className={`pl-status pl-status-${session.diagnosis.source === 'demo' ? 'awaiting_approval' : 'verified'}`}
                >
                  {session.diagnosis.source === 'demo' ? 'DEMO / MOCK' : 'Muse Spark'}
                </span>
                {session.diagnosis.model ? (
                  <span className='pl-muted'> · {session.diagnosis.model}</span>
                ) : null}
              </p>
              <p>
                <strong>{session.diagnosis.problem_summary}</strong>
              </p>
              <p className='pl-muted'>{session.diagnosis.likely_root_cause}</p>
              <p>Confidence: {(session.diagnosis.confidence * 100).toFixed(0)}%</p>
              <p>{session.diagnosis.proposed_minimal_fix}</p>
              <ul>
                {session.diagnosis.evidence.map((e) => (
                  <li key={`${e.kind}-${e.summary}`}>
                    <span className='pl-muted'>[{e.kind}]</span> {e.summary}
                  </li>
                ))}
              </ul>
              {proposed?.status === 'proposed' ? (
                <div className='pl-actions'>
                  <button
                    className='pl-btn pl-btn-primary'
                    type='button'
                    disabled={!!busy}
                    onClick={() => void approve('approve')}
                  >
                    Approve &amp; verify
                  </button>
                  <button
                    className='pl-btn pl-btn-secondary'
                    type='button'
                    disabled={!!busy}
                    onClick={() => void approve('reject')}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              {proposed ? (
                <p className='pl-muted' style={{ marginTop: '1rem' }}>
                  Patch: {proposed.proposal.summary} ({proposed.status})
                </p>
              ) : null}
            </>
          ) : (
            <p className='pl-muted'>Diagnosis appears after analysis.</p>
          )}
          {report ? (
            <div style={{ marginTop: '1rem' }}>
              <h4>Verification report</h4>
              <pre className='pl-code'>{JSON.stringify(report, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      </aside>

      <section className='pl-panel pl-logs'>
        <h3>Command output / audit</h3>
        <div className='pl-panel-body'>
          {session?.executions?.length ? (
            session.executions.map((e, i) => (
              <div key={`${e.command}-${i}`} style={{ marginBottom: '1rem' }}>
                <strong>
                  {e.command} · exit {e.exitCode} · {e.ok ? 'PASS' : 'FAIL'} · {e.durationMs}ms
                </strong>
                <pre className='pl-code'>{e.stderr || e.stdout || '(no output)'}</pre>
              </div>
            ))
          ) : (
            <p className='pl-muted'>Verification output appears after you approve a patch.</p>
          )}
          {session?.audit?.length ? (
            <pre className='pl-code'>
              {session.audit.map((a) => `${a.ts} ${a.type}: ${a.detail}`).join('\n')}
            </pre>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default function PatchllamaWorkspacePage() {
  return (
    <Suspense fallback={<main className='pl-main pl-muted'>Loading workspace…</main>}>
      <WorkspaceInner />
    </Suspense>
  )
}
