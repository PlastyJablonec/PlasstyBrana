import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { optimizedMqttService } from '../services/optimizedMqttService';
import LoadingSpinner from './LoadingSpinner';

interface GateControlProps {
  onLastActionChange: (action: string) => void;
}

const GateControl: React.FC<GateControlProps> = ({ onLastActionChange }) => {
  const { user, mqttStatus } = useAppContext();
  
  // Ref to always have current mqttStatus for intervals
  const mqttStatusRef = useRef(mqttStatus);
  mqttStatusRef.current = mqttStatus;

  // State management
  const [gateLoading, setGateLoading] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [gateOpenTime, setGateOpenTime] = useState(0);
  const [showOpenDuration, setShowOpenDuration] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [autoCloseTimeLimit, setAutoCloseTimeLimit] = useState(250);
  const [lastAction, setLastAction] = useState('');

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('gateControlSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setAutoCloseTimeLimit(settings.autoCloseTimeLimit || 250);
      }
    } catch (error) {
      console.error('❌ Error loading gate control settings:', error);
    }
  }, []);

  // Update open duration in real-time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (showOpenDuration && gateOpenTime > 0) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showOpenDuration, gateOpenTime]);

  // Main gate logic useEffect
  useEffect(() => {
    const freshStatus = mqttStatusRef.current.gateStatus || '';
    const currentStatus = freshStatus?.toLowerCase() || '';
    const originalStatus = freshStatus || '';
    
    const isGateOpen = currentStatus.includes('otevřena') || 
                      currentStatus.includes('open') ||
                      currentStatus.includes('otevreno') ||
                      currentStatus.includes('brána otevřena') ||
                      currentStatus.includes('gate open') ||
                      originalStatus.includes('Brána otevřena') ||
                      originalStatus.includes('Gate open') ||
                      originalStatus.includes('OPEN');
    const isGateClosed = currentStatus.includes('zavřena') || 
                        currentStatus.includes('closed') ||
                        currentStatus.includes('zavřeno');

    // Start countdown when gate opens
    if (isGateOpen && !autoCloseEnabled) {
      console.log('🚪 Gate opened - starting auto-close countdown');
      const openTime = Date.now();
      setAutoCloseEnabled(true);
      setAutoCloseCountdown(autoCloseTimeLimit);
      setGateOpenTime(openTime);
      setShowOpenDuration(false);
    }
    
    // Stop countdown when gate closes
    if ((isGateClosed || currentStatus.includes('zavírání')) && autoCloseEnabled) {
      console.log('🚪 Gate closing/closed - stopping auto-close countdown');
      setAutoCloseEnabled(false);
      setAutoCloseCountdown(0);
      setGateOpenTime(0);
      setShowOpenDuration(false);
    }
  }, [mqttStatus.gateStatus, autoCloseEnabled, autoCloseTimeLimit]);

  // Auto-close countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (autoCloseEnabled && autoCloseCountdown > 0) {
      interval = setInterval(() => {
        setAutoCloseCountdown(prev => {
          if (prev <= 1) {
            setAutoCloseEnabled(false);
            setShowOpenDuration(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoCloseEnabled, autoCloseCountdown]);

  const handleGateCommand = useCallback(async () => {
    if (!user) {
      console.log('❌ No user found - cannot send gate command');
      return;
    }

    console.log('🚪 Sending gate command...');
    setGateLoading(true);
    const action = 'Odesílám příkaz brány...';
    setLastAction(action);
    onLastActionChange(action);
    
    try {
      const userIdentification = user.displayName || user.email;
      await optimizedMqttService.publishGateCommand(userIdentification);
      const successAction = 'Příkaz odeslán - brána se otevírá';
      setLastAction(successAction);
      onLastActionChange(successAction);
    } catch (error) {
      console.error('❌ Error sending gate command:', error);
      const errorAction = 'Chyba při odesílání příkazu';
      setLastAction(errorAction);
      onLastActionChange(errorAction);
    } finally {
      setGateLoading(false);
      setTimeout(() => {
        setLastAction('');
        onLastActionChange('');
      }, 3000);
    }
  }, [user, onLastActionChange]);

  const formatCountdown = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${secs}s`;
    }
  }, []);

  const formatOpenDuration = useCallback((openTime: number, currentTime: number) => {
    if (!openTime || openTime === 0) return '';
    
    const duration = Math.floor((currentTime - openTime) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  const getGateStatusColor = () => {
    const status = mqttStatus.gateStatus?.toLowerCase() || '';
    if (status.includes('otevřena') || status.includes('open')) return 'text-green-600';
    if (status.includes('zavřena') || status.includes('closed')) return 'text-red-600';
    if (status.includes('otevírá') || status.includes('opening')) return 'text-yellow-600';
    if (status.includes('zavírá') || status.includes('closing')) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getGateStatusIcon = () => {
    const status = mqttStatus.gateStatus?.toLowerCase() || '';
    if (status.includes('otevřena') || status.includes('open')) return '🔓';
    if (status.includes('zavřena') || status.includes('closed')) return '🔒';
    if (status.includes('otevírá') || status.includes('opening')) return '🔄';
    if (status.includes('zavírá') || status.includes('closing')) return '🔄';
    return '❓';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Ovládání brány</h2>
        <div className={`flex items-center space-x-2 ${getGateStatusColor()}`}>
          <span className="text-2xl">{getGateStatusIcon()}</span>
          <span className="font-medium">{mqttStatus.gateStatus || 'Neznámý stav'}</span>
        </div>
      </div>

      {/* Auto-close countdown */}
      {autoCloseEnabled && autoCloseCountdown > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600">⏰</span>
              <span className="text-sm font-medium text-yellow-800">
                Automatické zavření za:
              </span>
            </div>
            <span className="text-lg font-bold text-yellow-900">
              {formatCountdown(autoCloseCountdown)}
            </span>
          </div>
        </div>
      )}

      {/* Open duration display */}
      {showOpenDuration && gateOpenTime > 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600">⏱️</span>
              <span className="text-sm font-medium text-green-800">
                Brána otevřena:
              </span>
            </div>
            <span className="text-lg font-bold text-green-900">
              {formatOpenDuration(gateOpenTime, currentTime)}
            </span>
          </div>
        </div>
      )}

      {/* Gate control button */}
      <div className="flex flex-col items-center">
        <button
          onClick={handleGateCommand}
          disabled={gateLoading}
          className="w-full max-w-xs px-8 py-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 flex flex-col items-center space-y-3 shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-105 disabled:scale-100"
        >
          {gateLoading ? (
            <LoadingSpinner />
          ) : (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          )}
          <span className="text-lg font-semibold">
            {gateLoading ? 'Odesílám...' : 'Otevřít/Zavřít bránu'}
          </span>
        </button>
      </div>

      {/* Additional info */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">📡</span>
            <span className="text-gray-700">
              MQTT: {mqttStatus.isConnected ? 'Připojeno' : 'Odpojeno'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">👤</span>
            <span className="text-gray-700">
              Uživatel: {user?.displayName || user?.email || 'Neznámý'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateControl;
