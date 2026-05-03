import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Shield, Smartphone, Zap, Lock, BookOpen, Copy, ArrowRight, RefreshCw, AlertCircle, Check } from 'lucide-react'

export default function PairingScreen({ sessionStatus, qrUrl, sessionToken, onRefresh, onSkip }) {
  const [copied, setCopied] = useState(false)
  const isCreating = sessionStatus === 'creating'
  const isInvalid = sessionStatus === 'invalid'
  const isError = sessionStatus === 'error'
  
  const handleCopy = () => {
    if (qrUrl) {
      navigator.clipboard.writeText(qrUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="pairing-screen">
      {/* Top Bar with Logo and Badge */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 'var(--space-6) var(--space-10)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#111110',
          }}>
            <Zap size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>ClawDeck</h1>
            <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-muted)' }}>AI Developer Dashboard</p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-surface-2)',
          padding: '6px 14px',
          borderRadius: '999px',
          border: '1px solid var(--border-strong)',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          Waiting for connection
        </div>
      </div>

      <div className="pairing-layout">
        {/* Left Column: Content */}
        <div className="pairing-content">
          <h2 style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1.1, marginBottom: 'var(--space-4)', letterSpacing: '-0.03em' }}>
            <span style={{ color: 'var(--text-primary)' }}>Connect Your</span><br />
            <span style={{ color: 'var(--accent)' }}>Mobile Device</span>
          </h2>
          <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-10)', maxWidth: 400 }}>
            Scan the QR code with your mobile device to securely connect and control your development environment.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                <Shield size={20} color="var(--accent)" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Secure Connection</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>End-to-end encrypted pairing</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                <Smartphone size={20} color="var(--accent)" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Real-time Control</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Execute commands from anywhere</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                <Zap size={20} color="var(--accent)" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Instant Sync</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>See logs and results in real-time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: QR Card */}
        <div className="pairing-card" style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
              <Lock size={14} />
              Secure Session
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Scan to Connect</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Open ClawDeck mobile app and scan this code</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
            {isCreating ? (
              <div style={{ width: 240, height: 240, background: '#FAFAF9', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Creating session…</span>
              </div>
            ) : isInvalid || isError ? (
              <div style={{ width: 240, height: 240, background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', textAlign: 'center' }}>
                <AlertCircle size={32} color={isInvalid ? 'var(--warning)' : 'var(--error)'} />
                <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
                  {isInvalid ? 'Session expired or invalid.' : 'Unable to connect.'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {isInvalid ? 'Please scan again.' : 'Ensure both devices are on same WiFi or use hotspot.'}
                </span>
                <button onClick={onRefresh} className="btn btn-primary" style={{ marginTop: 'var(--space-2)', background: 'var(--bg-elevated)' }}>
                  <RefreshCw size={14} />
                  New Session
                </button>
              </div>
            ) : qrUrl ? (
              <div style={{ padding: 'var(--space-4)', background: '#FAFAF9', borderRadius: 'var(--radius-xl)' }}>
                <QRCodeSVG
                  value={qrUrl}
                  size={240}
                  bgColor="#FAFAF9"
                  fgColor="#111110"
                  level="M"
                  style={{ display: 'block' }}
                />
              </div>
            ) : null}
          </div>

          {/* Manual Connection Section */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-5)', marginTop: 'var(--space-2)' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Connect manually</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>If QR doesn't work, open this link on your mobile (same WiFi)</p>
            
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {qrUrl ? qrUrl.replace(sessionToken, `${sessionToken.substring(0, 8)}...${sessionToken.substring(sessionToken.length - 4)}`) : 'Generating...'}
                </div>
              </div>
              <button 
                className="btn btn-ghost" 
                style={{ padding: '6px', flexShrink: 0, color: copied ? 'var(--success)' : 'var(--text-primary)' }} 
                onClick={handleCopy}
                disabled={!qrUrl}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied && <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>Copied</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 'var(--space-6) var(--space-10)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(17, 17, 16, 0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          <Shield size={16} />
          Your connection is private and secure
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button className="btn btn-primary" onClick={onSkip} style={{ background: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }}>
            Continue to Dashboard
            <ArrowRight size={16} />
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Need help?</span>
          <button className="btn btn-ghost" style={{ color: 'var(--accent)', borderColor: 'var(--border-subtle)' }}>
            <BookOpen size={16} />
            View Guide
          </button>
        </div>
      </div>
    </div>
  )
}
