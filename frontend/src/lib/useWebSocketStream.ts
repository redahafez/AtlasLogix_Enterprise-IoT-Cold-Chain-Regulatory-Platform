'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './api';

export type SocketConnectionState =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'unavailable'
  | 'not permitted';

export interface SensorEventPayload {
  eventId: string;
  type: string;
  tenantId: string;
  shipmentId: string;
  recordedAt: string;
  publishedAt: string;
  payload: {
    temperature: number;
    humidity: number;
    vibration?: number | null;
    batteryLevel?: number | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export function useWebSocketStream(
  tenantId: string | null,
  onSensorEvent?: (event: SensorEventPayload) => void
) {
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('connecting');
  const [latestEvent, setLatestEvent] = useState<SensorEventPayload | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffDelayRef = useRef<number>(1000);
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const connectSocket = useCallback(async () => {
    if (!tenantId) {
      setConnectionState('unavailable');
      return;
    }

    try {
      setConnectionState(prev => (prev === 'live' ? 'reconnecting' : 'connecting'));
      const { ticket, websocketUrl } = await api.createStreamTicket(tenantId);

      const wsUrl = websocketUrl || `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'}/ws/v1/sensor-data?ticket=${ticket}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        backoffDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connection.ready') {
            setConnectionState('live');
          } else if (data.type === 'sensor.reading.created' || data.eventId) {
            const sensorEvt = data as SensorEventPayload;
            if (!processedEventIdsRef.current.has(sensorEvt.eventId)) {
              processedEventIdsRef.current.add(sensorEvt.eventId);
              setLatestEvent(sensorEvt);
              if (onSensorEvent) {
                onSensorEvent(sensorEvt);
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse WS payload', e);
        }
      };

      ws.onerror = () => {
        setConnectionState('unavailable');
      };

      ws.onclose = (evt) => {
        socketRef.current = null;
        if (evt.code === 4403) {
          setConnectionState('not permitted');
          return;
        }

        if (evt.code === 4401) {
          // Retry with new ticket
          scheduleReconnect();
          return;
        }

        setConnectionState('reconnecting');
        scheduleReconnect();
      };
    } catch (err: any) {
      if (err?.error === 'FORBIDDEN' || err?.status === 403) {
        setConnectionState('not permitted');
      } else {
        setConnectionState('unavailable');
        scheduleReconnect();
      }
    }
  }, [tenantId, onSensorEvent]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    const delay = backoffDelayRef.current;
    backoffDelayRef.current = Math.min(delay * 2, 30000);
    reconnectTimeoutRef.current = setTimeout(() => {
      connectSocket();
    }, delay);
  }, [connectSocket]);

  useEffect(() => {
    // Reset state on tenant switch
    processedEventIdsRef.current.clear();
    setLatestEvent(null);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [tenantId, connectSocket]);

  return {
    connectionState,
    latestEvent,
    reconnect: connectSocket
  };
}
