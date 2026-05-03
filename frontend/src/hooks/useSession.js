import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

/**
 * useSession — manages QR session lifecycle + WebSocket connection.
 *
 * Returns everything the app needs: socket, session state, logs, task status.
 */
export function useSession() {
  const [sessionToken, setSessionToken] = useState(null)
  const [sessionStatus, setSessionStatus] = useState('creating') // creating | waiting | paired | disconnected
  const [qrUrl, setQrUrl] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const socketRef = useRef(null)

  // Detect mobile from URL param or user-agent
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionFromUrl = params.get('session')
    const ua = navigator.userAgent
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)

    if (sessionFromUrl) {
      // Validate session before attempting to pair
      setIsMobile(true)
      setSessionToken(sessionFromUrl)
      
      const validateAndPair = async () => {
        try {
          const res = await fetch(`/api/session/status/${sessionFromUrl}`)
          const data = await res.json()
          
          if (data.valid) {
            // Valid session, proceed with pairing
            await fetch('/api/session/pair', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: sessionFromUrl }),
            })
            setSessionStatus('paired')
          } else {
            // Invalid session
            setSessionToken(null)
            setSessionStatus('invalid')
          }
        } catch (err) {
          console.error('Failed to validate session:', err)
          setSessionToken(null)
          setSessionStatus('error')
        }
      }
      validateAndPair()
      
    } else if (mobile) {
      // Mobile but no session param — shouldn't normally happen
      setIsMobile(true)
      setSessionStatus('waiting')
    } else {
      // Laptop — create a new session
      setIsMobile(false)
      createNewSession()
    }
  }, [])

  const createNewSession = useCallback(async () => {
    setSessionStatus('creating')
    try {
      const res = await fetch('/api/session/create')
      const data = await res.json()
      setSessionToken(data.token)
      setQrUrl(data.qrUrl)
      setSessionStatus('waiting')
    } catch (err) {
      console.error('Failed to create session:', err)
      setSessionStatus('disconnected')
    }
  }, [])

  const refreshSession = useCallback(() => {
    // Disconnect old socket if any
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    createNewSession()
  }, [createNewSession])

  // Connect WebSocket when we have a session token
  useEffect(() => {
    if (!sessionToken) return

    const role = isMobile ? 'mobile' : 'laptop'

    const socket = io(
      isMobile ? window.location.origin : 'http://localhost:3001',
      {
        transports: ['websocket', 'polling'],
        query: { role, session: sessionToken },
      }
    )

    socketRef.current = socket

    socket.on('session:paired', () => {
      setSessionStatus('paired')
    })

    socket.on('session:disconnected', () => {
      setSessionStatus('disconnected')
    })

    return () => {
      socket.disconnect()
    }
  }, [sessionToken, isMobile])

  // User explicitly skipping the QR pairing to use dashboard locally
  const skipPairing = useCallback(() => {
    setSessionStatus('paired')
  }, [])

  return {
    sessionToken,
    sessionStatus,
    qrUrl,
    isMobile,
    refreshSession,
    skipPairing,
    socketRef,
  }
}
