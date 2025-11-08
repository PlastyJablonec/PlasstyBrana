import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';

interface GateCountdownDisplayProps {
  onLastActionChange: (action: string) => void;
}

const GateCountdownDisplay: React.FC<GateCountdownDisplayProps> = ({ onLastActionChange }) => {
  const { mqttStatus } = useAppContext();
  
  // State for countdown displays
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [gateOpenTime, setGateOpenTime] = useState(0);
  const [showOpenDuration, setShowOpenDuration] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const autoCloseTimeLimit = 250;

  // Listen for gate sync events
  useEffect(() => {
    const handleGateSync = (e: CustomEvent) => {
      const data = e.detail;
      setAutoCloseEnabled(data.autoCloseEnabled);
      setAutoCloseCountdown(data.autoCloseCountdown);
      setGateOpenTime(data.gateOpenTime);
      setShowOpenDuration(data.showOpenDuration);
      setCurrentTime(data.currentTime);
    };

    window.addEventListener('gateSync', handleGateSync as EventListener);
    return () => window.removeEventListener('gateSync', handleGateSync as EventListener);
  }, []);

  // Update current time for open duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showOpenDuration && gateOpenTime > 0) {
      interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [showOpenDuration, gateOpenTime]);

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
    return () => { if (interval) clearInterval(interval); };
  }, [autoCloseEnabled, autoCloseCountdown]);

  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (minutes > 0) return `${minutes}:${secs.toString().padStart(2, '0')}`;
    return `${secs}s`;
  };

  const formatOpenDuration = (openTime: number, currentTime: number) => {
    if (!openTime || openTime === 0) return '';
    
    const duration = Math.floor((currentTime - openTime) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return `${seconds}s`;
  };

  // Don't render anything if no countdown is active
  if (!autoCloseEnabled && !showOpenDuration) {
    return null;
  }

  return (
    <>
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
    </>
  );
};

export default GateCountdownDisplay;
