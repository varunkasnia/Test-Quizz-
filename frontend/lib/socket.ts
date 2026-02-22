import { io, Socket } from 'socket.io-client';

// 1. Ensure this ENV variable in Render is: https://certifiacate-app-1.onrender.com
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(WS_URL, {
      // 2. CRITICAL: Force websocket only for Render/Cloud stability
      transports: ['websocket'], 
      
      // 3. Explicitly define the path to match your FastAPI wrapper
      path: "/socket.io/", 
      
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      
      // 4. Added for HTTPS/WSS security compatibility
      secure: true,
      rejectUnauthorized: false // Helps if there are self-signed cert issues
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
