import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useSocket({ sessionCode, userToken, onUsers, onMatch, onEnded }) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionCode || !userToken) return;

    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('session:join', { sessionCode, userToken });
    });

    socket.on('session:users', ({ users }) => onUsers?.(users));
    socket.on('session:match', ({ movie }) => onMatch?.(movie));
    socket.on('session:ended', () => onEnded?.());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionCode, userToken]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}
