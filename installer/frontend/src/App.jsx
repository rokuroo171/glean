import React, { useState, useEffect } from 'react'

export default function App() {
  const [step, setStep] = useState('welcome')
  const [installDir, setInstallDir] = useState('')
  const [defaultDir, setDefaultDir] = useState('')
  const [launchOnDone, setLaunchOnDone] = useState(true)
  const [error, setError] = useState('')
  const [installProgress, setInstallProgress] = useState(0)
  const [installStatus, setInstallStatus] = useState('')
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const m = window.go?.main?.Installer
    if (m?.InstallInfo) {
      const info = m.InstallInfo()
      setDefaultDir(info.defaultDir)
      setInstallDir(info.defaultDir)
    }
  }, [])

  const handleBrowse = () => {
    const dir = prompt('Enter install location:', installDir)
    if (dir && dir.trim()) {
      setInstallDir(dir.trim())
      window.go?.main?.Installer?.SetInstallDir(dir.trim())
    }
  }

  const handleInstall = async () => {
    setStep('installing')
    setInstallStatus('Preparing installation...')
    setInstallProgress(10)

    const stages = [
      { msg: 'Creating directories...', pct: 25 },
      { msg: 'Copying glean.exe...', pct: 50 },
      { msg: 'Creating Start Menu shortcut...', pct: 75 },
      { msg: 'Registering application...', pct: 90 },
    ]

    for (const s of stages) {
      setInstallStatus(s.msg)
      setInstallProgress(s.pct)
      await new Promise(r => setTimeout(r, 400))
    }

    // Get source directory
    const srcDir = window.go?.main?.SourceDir?.Get() || '.'
    const result = window.go?.main?.Installer?.Install(srcDir) || { success: 'true', error: '' }

    setInstallProgress(100)
    setInstallStatus('Installation complete!')

    if (result.success === 'false') {
      setError(result.error)
      setStep('error')
    } else {
      await new Promise(r => setTimeout(r, 600))
      setStep('done')
    }
  }

  const handleFinish = () => {
    if (launchOnDone) {
      window.go?.main?.Installer?.LaunchGlean()
    }
    setExiting(true)
    setTimeout(() => {
      window.runtime?.WindowClose()
    }, 400)
  }

  return (
    <div className={`installer ${exiting ? 'exit' : ''}`}>
      {step === 'welcome' && (
        <div className="step fade-in">
          <div className="brand">
            <div className="logo-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>
                <path d="M20 2v4"/>
                <path d="M22 4h-4"/>
                <circle cx="4" cy="20" r="2"/>
              </svg>
            </div>
            <h1 className="title">glean</h1>
          </div>
          <p className="subtitle">A place for your thoughts to grow.</p>
          <p className="desc">
            This wizard will guide you through the installation of Glean v1.0.0 on your system.
          </p>
          <div className="spacer" />
          <div className="btn-row">
            <button className="btn primary wide" onClick={() => setStep('location')}>
              Next &gt;
            </button>
          </div>
        </div>
      )}

      {step === 'location' && (
        <div className="step fade-in">
          <h2>Choose Install Location</h2>
          <p className="desc">Select where Glean should be installed on your system.</p>
          <div className="path-display">
            <span className="path-label">Install to:</span>
            <div className="path-row">
              <input
                className="path-input"
                value={installDir}
                onChange={e => {
                  setInstallDir(e.target.value)
                  window.go?.main?.Installer?.SetInstallDir(e.target.value)
                }}
                spellCheck={false}
              />
              <button className="btn browse" onClick={handleBrowse}>Browse...</button>
            </div>
          </div>
          <p className="hint">Requires approximately 15 MB of disk space.</p>
          <div className="spacer" />
          <div className="btn-row spread">
            <button className="btn" onClick={() => setStep('welcome')}>&lt; Back</button>
            <button className="btn primary wide" onClick={handleInstall}>Install</button>
          </div>
        </div>
      )}

      {step === 'installing' && (
        <div className="step fade-in centered">
          <h2>Installing Glean</h2>
          <p className="desc">Please wait while Glean is being installed...</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${installProgress}%` }} />
          </div>
          <p className="status">{installStatus}</p>
        </div>
      )}

      {step === 'error' && (
        <div className="step fade-in centered">
          <h2>Installation Failed</h2>
          <p className="error-msg">{error}</p>
          <div className="spacer" />
          <div className="btn-row">
            <button className="btn primary wide" onClick={() => setStep('location')}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="step fade-in centered">
          <div className="check-circle">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c9923a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2>Installation Complete</h2>
          <p className="desc">Glean has been installed to:</p>
          <p className="path">{installDir}</p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={launchOnDone}
              onChange={e => setLaunchOnDone(e.target.checked)}
            />
            <span>Launch Glean now</span>
          </label>
          <div className="spacer" />
          <div className="btn-row">
            <button className="btn primary wide" onClick={handleFinish}>Finish</button>
          </div>
        </div>
      )}

      <div className="footer">
        <span className="footer-text">Glean Installer v1.0.0</span>
      </div>
    </div>
  )
}
