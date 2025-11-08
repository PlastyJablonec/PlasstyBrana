import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { optimizedMqttService } from '../services/optimizedMqttService';

interface GateStatusTrackerProps {
  onLastActionChange: (action: string) => void;
}

const GateStatusTracker: React.FC<GateStatusTrackerProps> = ({ onLastActionChange }) => {
  const { user, mqttStatus } = useAppContext();
  
  // Ref to always have current mqttStatus for intervals
  const mqttStatusRef = useRef(mqttStatus);
  mqttStatusRef.current = mqttStatus;

  // State management
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [gateOpenTime, setGateOpenTime] = useState(0);
  const [showOpenDuration, setShowOpenDuration] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const autoCloseTimeLimit = 250;
  const [openCheckCountdown, setOpenCheckCountdown] = useState(0);
  const [openCheckEnabled, setOpenCheckEnabled] = useState(false);
  const [gateCommandRetry, setGateCommandRetry] = useState(false);
  const [gateCommandTimeout, setGateCommandTimeout] = useState<NodeJS.Timeout | null>(null);

  
  // Update open duration in real-time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showOpenDuration && gateOpenTime > 0) {
      interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [showOpenDuration, gateOpenTime]);

  // Main gate logic useEffect
  useEffect(() => {
    const freshStatus = mqttStatusRef.current.gateStatus || '';
    const currentStatus = freshStatus?.toLowerCase() || '';
    const originalStatus = freshStatus || '';
    
    const isGateOpen = currentStatus.includes('otevřena') || currentStatus.includes('open') ||
                      currentStatus.includes('otevreno') || currentStatus.includes('brána otevřena') ||
                      currentStatus.includes('gate open') || originalStatus.includes('Brána otevřena') ||
                      originalStatus.includes('Gate open') || originalStatus.includes('OPEN');
    const isGateClosed = currentStatus.includes('zavřena') || currentStatus.includes('closed') ||
                        currentStatus.includes('zavřeno');

    // Start countdown when gate opens
    if (isGateOpen && !autoCloseEnabled) {
      console.log('🚪 Gate opened - starting auto-close countdown');
      const openTime = Date.now();
      setAutoCloseEnabled(true);
      setAutoCloseCountdown(autoCloseTimeLimit);
      setGateOpenTime(openTime);
      setShowOpenDuration(false);
      
      const syncData = { autoCloseEnabled: true, autoCloseCountdown: autoCloseTimeLimit, 
                        gateOpenTime: openTime, showOpenDuration: false, 
                        currentTime: Date.now(), timestamp: Date.now() };
      localStorage.setItem('gateSync', JSON.stringify(syncData));
      window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));
    }
    
    // Stop countdown when gate closes
    if ((isGateClosed || currentStatus.includes('zavírání')) && autoCloseEnabled) {
      console.log('🚪 Gate closing/closed - stopping auto-close countdown');
      setAutoCloseEnabled(false);
      setAutoCloseCountdown(0);
      setGateOpenTime(0);
      setShowOpenDuration(false);
      
      const syncData = { autoCloseEnabled: false, autoCloseCountdown: 0, 
                        gateOpenTime: 0, showOpenDuration: false, 
                        currentTime: Date.now(), timestamp: Date.now() };
      localStorage.setItem('gateSync', JSON.stringify(syncData));
      window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));
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
    return () => { if (interval) clearInterval(interval); };
  }, [autoCloseEnabled, autoCloseCountdown]);

  // Open check countdown
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;
    if (openCheckEnabled && openCheckCountdown > 0) {
      let checkCount = 0;
      const maxChecks = Math.ceil(openCheckCountdown / 0.5);
      
      checkInterval = setInterval(() => {
        checkCount++;
        const freshStatus = mqttStatusRef.current.gateStatus || '';
        const currentStatus = freshStatus?.toLowerCase() || '';
        const originalStatus = freshStatus || '';
        const isGateOpening = currentStatus.includes('otevírá se') || currentStatus.includes('opening') ||
                              currentStatus.includes('otevirá se') || currentStatus.includes('otevirá') ||
                              currentStatus.includes('otevreni') || originalStatus.includes('Otevírá se...') ||
                              originalStatus.includes('Opening...') || originalStatus.includes('OTEVIRA SE') ||
                              originalStatus.includes('Otevírá se') || originalStatus.includes('otevírá se') ||
                              originalStatus.includes('OTEVÍRÁ SE');

        if (isGateOpening) {
          console.log(' Gate started opening - stopping check countdown');
          if (checkInterval) clearInterval(checkInterval);
          setOpenCheckEnabled(false);
          setOpenCheckCountdown(0);
          onLastActionChange('Brána se otevírá...');
          setTimeout(() => onLastActionChange(''), 3000);
        } else if (checkCount >= maxChecks) {
          console.log(' Time limit reached - gate did not start opening, retrying command...');
          if (checkInterval) clearInterval(checkInterval);
          setGateCommandRetry(true);
          setOpenCheckEnabled(false);
          setOpenCheckCountdown(0);
          onLastActionChange('Provádím druhý pokus o otevření...');
          setTimeout(() => onLastActionChange(''), 3000);
        }
      }, 500);
    }
    return () => { if (checkInterval) clearInterval(checkInterval); };
  }, [openCheckEnabled, openCheckCountdown, onLastActionChange]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (gateCommandTimeout) {
        clearTimeout(gateCommandTimeout);
      }
    };
  }, []);

  return null; // This component only handles logic, no UI
};

export default GateStatusTracker;
