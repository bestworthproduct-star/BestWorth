import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export const useSocket = (event: string, callback: (data: any) => void) => {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Connect to backend socket server
    socketRef.current = io('http://localhost:5000')

    socketRef.current.on('connect', () => {
      console.log('Connected to Real-time Sync Engine')
    })

    socketRef.current.on(event, callback)

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [event, callback])

  return socketRef.current
}
