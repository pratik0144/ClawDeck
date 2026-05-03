import { useSession } from './hooks/useSession'
import PairingScreen from './components/PairingScreen'
import Dashboard from './components/Dashboard'
import MobileLayout from './components/MobileLayout'
import './App.css'

function App() {
  const {
    sessionToken,
    sessionStatus,
    qrUrl,
    isMobile,
    refreshSession,
    skipPairing,
    socketRef,
  } = useSession()

  // Mobile device → show mobile layout
  if (isMobile && sessionToken) {
    return (
      <MobileLayout
        socketRef={socketRef}
        sessionStatus={sessionStatus}
      />
    )
  }

  // Laptop: show pairing screen until connected
  if (sessionStatus !== 'paired') {
    return (
      <PairingScreen
        sessionStatus={sessionStatus}
        qrUrl={qrUrl}
        sessionToken={sessionToken}
        onRefresh={refreshSession}
        onSkip={skipPairing}
      />
    )
  }

  // Laptop: paired → dashboard
  return (
    <Dashboard
      socketRef={socketRef}
      sessionStatus={sessionStatus}
    />
  )
}

export default App
