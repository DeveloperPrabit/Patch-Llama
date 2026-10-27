/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama layout — dark charcoal + lime + violet developer tooling shell
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import './patchllama.css'

export default function PatchllamaLayout({ children }: { children: ReactNode }) {
  return (
    <div className='pl-shell'>
      <header className='pl-header'>
        <Link href='/patchllama' className='pl-brand'>
          <span className='pl-mark'>PL</span>
          <span>
            PatchLlama
            <small>Find the bug. Fix the code. Prove it works.</small>
          </span>
        </Link>
        <nav className='pl-nav'>
          <Link href='/patchllama'>Home</Link>
          <Link href='/patchllama/dashboard'>Dashboard</Link>
          <Link href='/patchllama/workspace'>Workspace</Link>
          <Link href='/patchllama/settings'>Settings</Link>
        </nav>
      </header>
      {children}
    </div>
  )
}
