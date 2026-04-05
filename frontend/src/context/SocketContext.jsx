import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { TOKEN_KEY } from '../api/client.js';
import { AUTH_CHANGE_EVENT } from '../lib/authEvents.js';

const SocketContext = createContext({ socket: null, connected: false });

function getSocketBaseUrl() {
  const raw = import.meta.env.VITE_SOCKET_URL;
  if (raw && String(raw).trim()) {
    return String(raw).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let s = null;

    const setup = () => {
      if (s) {
        s.removeAllListeners();
        s.disconnect();
        s = null;
      }
      setSocket(null);
      setConnected(false);

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      const instance = io(getSocketBaseUrl(), {
        path: '/socket.io/',
        auth: { token },
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      s = instance;
      setSocket(instance);

      instance.on('connect', () => setConnected(true));
      instance.on('disconnect', () => setConnected(false));
      instance.on('connect_error', () => {
        setConnected(false);
      });

      instance.on('notification', (payload) => {
        const title = payload?.title || 'Thông báo';
        const body = payload?.content || '';
        toast(`${title}: ${body}`, { duration: 5000 });
      });
    };

    setup();
    window.addEventListener(AUTH_CHANGE_EVENT, setup);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, setup);
      if (s) {
        s.removeAllListeners();
        s.disconnect();
      }
    };
  }, []);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
