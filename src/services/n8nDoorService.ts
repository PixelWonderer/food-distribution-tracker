const LOCAL_STORAGE_KEY = 'doorUnlock.credentials'

const ENV_WEBHOOK_URL = (import.meta.env.VITE_DOOR_UNLOCK_URL as string | undefined)?.trim()
const DEFAULT_TIMEOUT = 10000 // 10 seconds

export interface DoorUnlockConfig {
  webhookUrl: string
  timeoutMs: number
  username?: string
  password?: string
}

interface PersistedN8nDoorCredentials {
  username?: string
  password?: string // stored as base64 for lightweight obfuscation
}

export interface DoorUnlockResponse {
  success: boolean
  message: string
  user?: string
  timestamp?: string
}

/**
 * Handles communication with an optional door-unlock webhook (set VITE_DOOR_UNLOCK_URL).
 */
class N8nDoorService {
  private config: DoorUnlockConfig
  private listeners = new Set<(config: DoorUnlockConfig) => void>()
  private storageAvailable = this.checkStorageAvailability()
  constructor() {
    const resolvedWebhookUrl = ENV_WEBHOOK_URL || ''

    if (!resolvedWebhookUrl) {
      console.warn('VITE_DOOR_UNLOCK_URL is not set; door unlock is disabled.')
    }

    this.config = {
      webhookUrl: resolvedWebhookUrl,
      timeoutMs: DEFAULT_TIMEOUT,
    }

    this.hydrateFromStorage()

  }

  /**
   * Gets the best available webhook URL (env > fallback)
   */
  private async resolveWebhookUrl(): Promise<string> {
    return ENV_WEBHOOK_URL || this.config.webhookUrl
  }

  public get isConfigured(): boolean {
    return Boolean(ENV_WEBHOOK_URL || this.config.webhookUrl)
  }

  public get hasCredentials(): boolean {
    return Boolean(this.config.username && this.config.password)
  }

  public get currentConfig(): DoorUnlockConfig {
    return { ...this.config }
  }

  public subscribe(listener: (config: DoorUnlockConfig) => void): () => void {
    this.listeners.add(listener)
    listener(this.currentConfig)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public updateCredentials(credentials: { username?: string; password?: string }): void {
    if ('username' in credentials) {
      const trimmed = credentials.username?.trim()
      this.config.username = trimmed ? trimmed : undefined
    }

    if ('password' in credentials) {
      const trimmed = credentials.password?.trim()
      if (trimmed) {
        this.config.password = trimmed
      }
    }

    this.persistConfig()
    this.notifyListeners()
  }

  public clearStoredPassword(): void {
    if (!this.config.password) {
      return
    }

    this.config.password = undefined
    this.persistConfig()
    this.notifyListeners()
  }

  public clearStoredCredentials(): void {
    this.config.username = undefined
    this.config.password = undefined
    this.persistConfig()
    this.notifyListeners()
  }

  /**
   * Attempts to unlock the door with automatic retry on transient network failures.
   */
  public async triggerUnlock(): Promise<DoorUnlockResponse> {
    if (!this.hasCredentials) {
      throw new Error('Enter a username and password before unlocking the door.')
    }

    const isNetworkError = (err: any) => {
      const msg = (err?.message || '').toLowerCase()
      return (
        err?.name === 'AbortError' ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network error') ||
        msg.includes('load failed') ||
        msg.includes('connection was lost')
      )
    }

    // Try once, then retry with fresh URL if it fails
    try {
      return await this.attemptUnlock(false)
    } catch (error: any) {
      // If it's a network/timeout error (not auth), invalidate cache and retry
      if (isNetworkError(error)) {
        console.warn('Unlock failed, retrying with same URL...')
        return await this.attemptUnlock(true)
      }
      // For auth errors or other failures, don't retry
      throw error
    }
  }

  /**
   * Internal method to attempt door unlock.
   * @param forceFreshUrl - Placeholder for future cache busting (no-op now)
   */
  private async attemptUnlock(_forceFreshUrl: boolean): Promise<DoorUnlockResponse> {
    // Resolve the best available webhook URL (env > fallback)
    const webhookUrl = await this.resolveWebhookUrl()
    if (!webhookUrl) {
      throw new Error('Door unlock URL is not configured.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
        signal: controller.signal,
      })

      // Parse the response from the unlock endpoint
      const data = await response.json().catch(() => null)

      if (!response.ok || !data) {
        const message =
          response.status === 401
            ? 'Load failed. Double-check your username/password.'
            : data?.message || `Unlock failed (${response.status}).`
        return { success: false, message }
      }

      // Use the success/message returned by the unlock endpoint
      return {
        success: data.success ?? false,
        message: data.message || (data.success ? 'Door unlocked!' : 'Unlock failed.'),
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Door unlock request timed out.')
      }

      const errorMessage = error?.message || 'Failed to contact unlock endpoint.'
      throw new Error(errorMessage)
    } finally {
      clearTimeout(timeout)
    }
  }

  private hydrateFromStorage(): void {
    if (!this.storageAvailable) {
      return
    }

    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!raw) {
        return
      }

      const persisted = JSON.parse(raw) as PersistedN8nDoorCredentials
      this.config.username = persisted.username?.trim() || this.config.username
      this.config.password = persisted.password ? this.decodePassword(persisted.password) : this.config.password
    } catch (error) {
      console.warn('Failed to load n8n door credentials from storage.', error)
    }
  }

  private persistConfig(): void {
    if (!this.storageAvailable) {
      return
    }

    try {
      if (!this.config.username && !this.config.password) {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY)
        return
      }

      const payload: PersistedN8nDoorCredentials = {
        username: this.config.username || undefined,
        password: this.config.password ? btoa(this.config.password) : undefined,
      }

      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn('Failed to persist n8n door credentials.', error)
    }
  }

  private notifyListeners(): void {
    const snapshot = this.currentConfig
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot)
      } catch (error) {
        console.warn('door unlock listener failed.', error)
      }
    })
  }

  private checkStorageAvailability(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false
    }

    try {
      const probeKey = '__door_unlock_probe__'
      window.localStorage.setItem(probeKey, '1')
      window.localStorage.removeItem(probeKey)
      return true
    } catch (error) {
      console.warn('Local storage unavailable. door credentials will not persist.', error)
      return false
    }
  }

  private decodePassword(encoded: string): string | undefined {
    try {
      return atob(encoded)
    } catch (error) {
      console.warn('Failed to decode stored door password.', error)
      return undefined
    }
  }

}

export const doorUnlockService = new N8nDoorService()
