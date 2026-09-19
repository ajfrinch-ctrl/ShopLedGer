import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import {
  getState,
  promptInstall,
  startPwaInstallTracking,
  subscribe,
  type PwaInstallState,
} from '../lib/pwaInstall'

/** PWA install state subscribe করার hook. */
export function usePwaInstall(): PwaInstallState & { install: () => Promise<void> } {
  const [state, setState] = useState<PwaInstallState>(() => {
    startPwaInstallTracking()
    return getState()
  })

  useEffect(() => {
    startPwaInstallTracking()
    return subscribe(setState)
  }, [])

  return {
    ...state,
    install: async () => {
      await promptInstall()
    },
  }
}

interface Props {
  className?: string
}

/**
 * "Install App" button — শুধু তখনই render হয় যখন:
 *  - ব্রাউজার `beforeinstallprompt` দিয়েছে (installable), এবং
 *  - অ্যাপ এখনো install করা নেই (standalone নয়)।
 * Installed অবস্থায় কিছুই render হয় না (no duplicate prompt/popup)।
 */
export default function InstallAppButton({ className = '' }: Props) {
  const { canInstall, isInstalled, install } = usePwaInstall()
  const [busy, setBusy] = useState(false)

  if (isInstalled || !canInstall) return null

  return (
    <button
      type="button"
      data-testid="install-app-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await install()
        } finally {
          setBusy(false)
        }
      }}
      className={
        className ||
        'w-full flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 disabled:opacity-60 text-white font-semibold py-3 rounded-xl border border-white/30 backdrop-blur-sm transition-all active:scale-[0.98]'
      }
    >
      <Download size={18} />
      Install App
    </button>
  )
}
