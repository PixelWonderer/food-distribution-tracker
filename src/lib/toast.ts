export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

/**
 * Lightweight toast notifications that do not depend on the legacy SCSS bundle.
 * Styles are injected lazily so we can keep the API stable for the existing store actions.
 */
class ToastService {
  private static container: HTMLElement | null = null;
  private static toasts = new Map<string, HTMLElement>();
  private static styleElement: HTMLStyleElement | null = null;

  private static ensureStyles(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (this.styleElement) {
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-toast-styles', 'true');
    style.textContent = `
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
  pointer-events: none;
}

@media (max-width: 480px) {
  .toast-container {
    left: 10px;
    right: 10px;
    bottom: 10px;
    max-width: none;
  }
}

.toast {
  background: #ffffff;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 250px;
  pointer-events: all;
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
}

.toast.toast-success {
  border-left-color: #48bb78;
  background: #f0fff4;
}

.toast.toast-error {
  border-left-color: #e53e3e;
  background: #fff5f5;
}

.toast.toast-warning {
  border-left-color: #ed8936;
  background: #fffaf0;
}

.toast.toast-info {
  border-left-color: #4299e1;
  background: #ebf8ff;
}

.toast.toast-enter {
  opacity: 0;
  transform: translateX(100%);
}

.toast.toast-exit {
  opacity: 0;
  transform: translateX(100%);
}

.toast-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
  color: #2d3748;
}

.toast-action {
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: #4299e1;
  white-space: nowrap;
}

.toast-action:hover {
  background: #4299e1;
  color: #ffffff;
}

.toast-close {
  background: transparent;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #718096;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:hover {
  color: #2d3748;
}
    `;

    document.head.appendChild(style);
    this.styleElement = style;
  }

  private static ensureContainer(): HTMLElement | null {
    if (typeof document === 'undefined') {
      return null;
    }

    this.ensureStyles();

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }

    return this.container;
  }

  static show(options: ToastOptions | string): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const config: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const { message, type = 'info', duration = 3000, action } = config;

    const container = this.ensureContainer();
    if (!container) {
      return null;
    }

    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast-enter`;
    toast.id = toastId;

    const icons: Record<ToastType, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
      ${action ? `<button class="toast-action">${action.label}</button>` : ''}
      <button class="toast-close" aria-label="Dismiss notification">×</button>
    `;

    const closeBtn = toast.querySelector<HTMLButtonElement>('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.dismiss(toastId));
    }

    if (action) {
      const actionBtn = toast.querySelector<HTMLButtonElement>('.toast-action');
      if (actionBtn) {
        actionBtn.addEventListener('click', () => {
          action.callback();
          this.dismiss(toastId);
        });
      }
    }

    container.appendChild(toast);
    this.toasts.set(toastId, toast);

    requestAnimationFrame(() => {
      toast.classList.remove('toast-enter');
    });

    if (duration > 0) {
      window.setTimeout(() => this.dismiss(toastId), duration);
    }

    return toastId;
  }

  static dismiss(toastId: string): void {
    const toast = this.toasts.get(toastId);
    if (!toast) {
      return;
    }

    toast.classList.add('toast-exit');

    window.setTimeout(() => {
      toast.remove();
      this.toasts.delete(toastId);

      if (this.toasts.size === 0 && this.container) {
        this.container.remove();
        this.container = null;
      }
    }, 300);
  }

  static dismissAll(): void {
    Array.from(this.toasts.keys()).forEach((toastId) => {
      this.dismiss(toastId);
    });
  }

  static success(message: string, duration = 3000): string | null {
    return this.show({ message, type: 'success', duration });
  }

  static error(message: string, action?: { label: string; callback: () => void }): string | null {
    return this.show({ message, type: 'error', duration: 5000, action });
  }

  static warning(message: string, duration = 4000): string | null {
    return this.show({ message, type: 'warning', duration });
  }

  static info(message: string, duration = 3000): string | null {
    return this.show({ message, type: 'info', duration });
  }
}

export const toast = ToastService;
