import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IsolationUnavailableError, assertDockerAvailable, probeDocker } from '../docker-executor'

describe('docker-executor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fails closed when docker probe fails', async () => {
    // Force cache miss by poking probe; if daemon is down this throws on assert
    const probe = await probeDocker()
    if (probe.ok) {
      // Environment has Docker — assert should pass
      await expect(assertDockerAvailable()).resolves.toBeUndefined()
      return
    }
    await expect(assertDockerAvailable()).rejects.toBeInstanceOf(IsolationUnavailableError)
    await expect(assertDockerAvailable()).rejects.toMatchObject({ code: 'ISOLATION_UNAVAILABLE' })
  })
})
