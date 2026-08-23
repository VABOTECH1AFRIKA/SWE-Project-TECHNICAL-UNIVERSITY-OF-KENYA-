/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CookieBanner from '../CookieBanner'

const CONSENT_KEY = 'c2_analytics_consent'

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    delete window.__SCC_INIT__
    delete window._allowCT
    delete window._trfd
    window._signalsDataLayer = []
    document.head.querySelectorAll('script[src*="scc-c2"]').forEach(s => s.remove())
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('standalone context (window.parent === window)', () => {
    it('renders banner when no consent is stored', () => {
      render(<CookieBanner />)
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText(/Cookie Consent/)).toBeInTheDocument()
    })

    it('saves consent and fires event on accept', async () => {
      const user = userEvent.setup()
      const eventListener = vi.fn()
      window.addEventListener('cookie-consent-changed', eventListener)

      render(<CookieBanner />)
      const acceptButton = screen.getByRole('button', { name: /Accept/ })

      await act(async () => {
        await user.click(acceptButton)
      })

      const storedConsent = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')
      expect(storedConsent.analytics).toBe(true)
      expect(storedConsent.timestamp).toBeDefined()
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { consented: true },
        })
      )

      window.removeEventListener('cookie-consent-changed', eventListener)
    })

    it('saves non-consent and fires event on decline', async () => {
      const user = userEvent.setup()
      const eventListener = vi.fn()
      window.addEventListener('cookie-consent-changed', eventListener)

      render(<CookieBanner />)
      const declineButton = screen.getByRole('button', { name: /Decline/ })

      await act(async () => {
        await user.click(declineButton)
      })

      const storedConsent = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')
      expect(storedConsent.analytics).toBe(false)
      expect(storedConsent.timestamp).toBeDefined()
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { consented: false },
        })
      )

      window.removeEventListener('cookie-consent-changed', eventListener)
    })

    it('does not show banner when valid consent already stored', () => {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true, timestamp: Date.now() }))
      render(<CookieBanner />)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  describe('embedded context (window.parent !== window)', () => {
    let mockParent: MessageEventSource

    beforeEach(() => {
      mockParent = {} as MessageEventSource
      Object.defineProperty(window, 'parent', {
        value: mockParent,
        configurable: true,
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'parent', {
        value: window,
        configurable: true,
      })
    })

    it('banner starts hidden (no consent, no reset message)', () => {
      render(<CookieBanner />)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('banner shows after receiving RESET_INITIAL_BUILD_HIDE from parent', () => {
      render(<CookieBanner />)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

      act(() => {
        const event = new MessageEvent('message', {
          data: { type: 'RESET_INITIAL_BUILD_HIDE' },
          source: mockParent,
        })
        window.dispatchEvent(event)
      })

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('ignores RESET_INITIAL_BUILD_HIDE from non-parent source', () => {
      render(<CookieBanner />)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

      act(() => {
        const event = new MessageEvent('message', {
          data: { type: 'RESET_INITIAL_BUILD_HIDE' },
          source: window, // Wrong source
        })
        window.dispatchEvent(event)
      })

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('ignores other message types', () => {
      render(<CookieBanner />)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

      act(() => {
        const event = new MessageEvent('message', {
          data: { type: 'SOME_OTHER_MESSAGE' },
          source: mockParent,
        })
        window.dispatchEvent(event)
      })

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('stays visible across a remount after RESET_INITIAL_BUILD_HIDE (survives iframe remount)', () => {
      const { unmount } = render(<CookieBanner />)

      act(() => {
        const event = new MessageEvent('message', {
          data: { type: 'RESET_INITIAL_BUILD_HIDE' },
          source: mockParent,
        })
        window.dispatchEvent(event)
      })
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()

      unmount()
      render(<CookieBanner />)

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('starts hidden on a fresh mount after INITIAL_BUILD_COMPLETE, even across a remount', () => {
      const { unmount } = render(<CookieBanner />)

      act(() => {
        const resetEvent = new MessageEvent('message', {
          data: { type: 'RESET_INITIAL_BUILD_HIDE' },
          source: mockParent,
        })
        window.dispatchEvent(resetEvent)
      })
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()

      act(() => {
        const completeEvent = new MessageEvent('message', {
          data: { type: 'INITIAL_BUILD_COMPLETE' },
          source: mockParent,
        })
        window.dispatchEvent(completeEvent)
      })
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

      unmount()
      render(<CookieBanner />)

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('grants analytics consent when INITIAL_BUILD_COMPLETE hides the banner', () => {
      const eventListener = vi.fn()
      window.addEventListener('cookie-consent-changed', eventListener)

      render(<CookieBanner />)

      act(() => {
        const resetEvent = new MessageEvent('message', {
          data: { type: 'RESET_INITIAL_BUILD_HIDE' },
          source: mockParent,
        })
        window.dispatchEvent(resetEvent)
      })

      act(() => {
        const completeEvent = new MessageEvent('message', {
          data: { type: 'INITIAL_BUILD_COMPLETE' },
          source: mockParent,
        })
        window.dispatchEvent(completeEvent)
      })

      const storedConsent = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')
      expect(storedConsent.analytics).toBe(true)
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { consented: true } })
      )

      window.removeEventListener('cookie-consent-changed', eventListener)
    })

    it('consent persists across remounts so consent-gated widgets load without the banner', () => {
      const { unmount } = render(<CookieBanner />)

      act(() => {
        const resetEvent = new MessageEvent('message', {
          data: { type: 'RESET_INITIAL_BUILD_HIDE' },
          source: mockParent,
        })
        window.dispatchEvent(resetEvent)
      })

      act(() => {
        const completeEvent = new MessageEvent('message', {
          data: { type: 'INITIAL_BUILD_COMPLETE' },
          source: mockParent,
        })
        window.dispatchEvent(completeEvent)
      })

      unmount()
      render(<CookieBanner />)

      const storedConsent = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')
      expect(storedConsent.analytics).toBe(true)
    })
  })

  describe('initTracking', () => {
    it('appends SCC script to document.head on first mount', () => {
      render(<CookieBanner />)
      const scripts = document.head.querySelectorAll('script[src*="scc-c2"]')
      expect(scripts.length).toBe(1)
    })

    it('initializes _trfd with ap property', () => {
      render(<CookieBanner />)
      expect(window._trfd).toBeDefined()
      expect((window._trfd as Array<{ ap: string }>)[0]).toMatchObject({ ap: 'airo-app-builder' })
    })

    it('does not append a second script when __SCC_INIT__ is already set', () => {
      window.__SCC_INIT__ = true
      render(<CookieBanner />)
      const scripts = document.head.querySelectorAll('script[src*="scc-c2"]')
      expect(scripts.length).toBe(0)
    })

    it('initializes _signalsDataLayer if not already present', () => {
      delete (window as Partial<Window>)._signalsDataLayer
      render(<CookieBanner />)
      expect(Array.isArray(window._signalsDataLayer)).toBe(true)
    })
  })

  describe('_allowCT flag management', () => {
    it('restores _allowCT = true from stored consent with analytics: true on mount', async () => {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true, timestamp: Date.now() }))
      await act(async () => { render(<CookieBanner />) })
      expect(window._allowCT).toBe(true)
    })

    it('restores _allowCT = false from stored consent with analytics: false on mount', async () => {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: false, timestamp: Date.now() }))
      await act(async () => { render(<CookieBanner />) })
      expect(window._allowCT).toBe(false)
    })

    it('does not set _allowCT when stored consent is expired', async () => {
      const expired = Date.now() - 366 * 24 * 60 * 60 * 1000
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true, timestamp: expired }))
      await act(async () => { render(<CookieBanner />) })
      expect(window._allowCT).toBeUndefined()
    })

    it('sets _allowCT = true when accept is clicked', async () => {
      const user = userEvent.setup()
      render(<CookieBanner />)
      await act(async () => { await user.click(screen.getByRole('button', { name: /Accept/ })) })
      expect(window._allowCT).toBe(true)
    })

    it('sets _allowCT = false when decline is clicked', async () => {
      const user = userEvent.setup()
      render(<CookieBanner />)
      await act(async () => { await user.click(screen.getByRole('button', { name: /Decline/ })) })
      expect(window._allowCT).toBe(false)
    })

    it('sets _allowCT = false when consent is revoked', () => {
      window._allowCT = true
      render(<CookieBanner />)
      act(() => { window.revokeAnalyticsConsent?.() })
      expect(window._allowCT).toBe(false)
    })
  })

  describe('click tracking', () => {
    it('pushes airo.website.click event when _allowCT is true', () => {
      window._allowCT = true
      render(<CookieBanner />)

      const btn = document.createElement('button')
      btn.textContent = 'Test'
      document.body.appendChild(btn)
      act(() => { btn.click() })
      document.body.removeChild(btn)

      const events = (window._signalsDataLayer as Array<{ data: { eid: string } }>)
        .filter(e => e?.data?.eid === 'airo.website.click')
      expect(events.length).toBeGreaterThan(0)
    })

    it('does not push events when _allowCT is false', () => {
      window._allowCT = false
      render(<CookieBanner />)

      const btn = document.createElement('button')
      btn.textContent = 'Test'
      document.body.appendChild(btn)
      act(() => { btn.click() })
      document.body.removeChild(btn)

      const events = (window._signalsDataLayer as Array<{ data: { eid: string } }>)
        .filter(e => e?.data?.eid === 'airo.website.click')
      expect(events.length).toBe(0)
    })

    it('uses hardcoded airo.website.click EID regardless of element location', () => {
      window._allowCT = true
      render(<CookieBanner />)

      const main = document.createElement('main')
      const btn = document.createElement('button')
      btn.textContent = 'Nav CTA'
      main.appendChild(btn)
      document.body.appendChild(main)
      act(() => { btn.click() })
      document.body.removeChild(main)

      const eids = (window._signalsDataLayer as Array<{ data: { eid: string } }>)
        .map(e => e?.data?.eid)
        .filter(Boolean)
      expect(eids.every(id => id === 'airo.website.click')).toBe(true)
    })
  })
})
