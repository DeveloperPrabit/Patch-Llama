/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama landing
 */

import Link from 'next/link'

export default function PatchllamaHomePage() {
  return (
    <main className='pl-main pl-hero'>
      <p className='pl-muted' style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12 }}>
        Meta Muse Spark · evidence-based debugging
      </p>
      <h1>Find the bug. Fix the code. Prove it works.</h1>
      <p>
        PatchLlama investigates failing builds and tests with Muse Spark, proposes a minimal patch,
        waits for your approval, then reruns the real verification command in an isolated workspace.
        A model suggestion alone never counts as a fix.
      </p>
      <div className='pl-actions'>
        <Link className='pl-btn pl-btn-primary' href='/patchllama/workspace'>
          Open workspace
        </Link>
        <Link className='pl-btn pl-btn-secondary' href='/patchllama/dashboard'>
          Dashboard
        </Link>
        <Link className='pl-btn pl-btn-secondary' href='/patchllama/settings'>
          Meta API status
        </Link>
      </div>
      <div className='pl-grid' style={{ marginTop: '3rem' }}>
        <div className='pl-card'>
          <strong>1</strong>
          <span className='pl-muted'>Intake failure evidence</span>
        </div>
        <div className='pl-card'>
          <strong>2</strong>
          <span className='pl-muted'>Muse Spark root-cause analysis</span>
        </div>
        <div className='pl-card'>
          <strong>3</strong>
          <span className='pl-muted'>Review &amp; approve patch</span>
        </div>
        <div className='pl-card'>
          <strong>4</strong>
          <span className='pl-muted'>Verify with real command output</span>
        </div>
      </div>
    </main>
  )
}
