import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { optimizedMqttService } from '../services/optimizedMqttService';

interface GateLogicState {
  gateLoading: boolean;
  autoCloseCountdown: number;
  autoCloseEnabled: boolean;
  openCheckCountdown: number;
  openCheckEnabled: boolean;
  gateOpenTime: number;
  showOpenDuration: boolean;
  currentTime: number;
  userLoading: boolean;
  autoCloseTimeLimit: number;
  retryTimeLimit: number;
  openCheckTimeLimit: number;
  gateCommandRetry: boolean;
  gateCommandTimeout: NodeJS.Timeout | null;
  lastAction: string;
}

interface GateLogicActions {
  handleGateCommand: () => Promise<void>;
  formatCountdown: (seconds: number) => string;
  formatOpenDuration: (openTime: number, currentTime: number) => string;
}

export const useGateLogic = (): GateLogicState & GateLogicActions => {
  const { user, mqttStatus } = useAppContext();
  
  // Ref to always have current mqttStatus for intervals
  const mqttStatusRef = useRef(mqttStatus);
  mqttStatusRef.current = mqttStatus;

  // State management
  const [gateLoading, setGateLoading] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [openCheckCountdown, setOpenCheckCountdown] = useState(0);
  const [openCheckEnabled, setOpenCheckEnabled] = useState(false);
  const [gateOpenTime, setGateOpenTime] = useState(0);
  const [showOpenDuration, setShowOpenDuration] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [userLoading, setUserLoading] = useState(true);
  const [autoCloseTimeLimit, setAutoCloseTimeLimit] = useState(250);
  const [retryTimeLimit, setRetryTimeLimit] = useState(3);
  const [openCheckTimeLimit, setOpenCheckTimeLimit] = useState(10);
  const [gateCommandRetry, setGateCommandRetry] = useState(false);
  const [gateCommandTimeout, setGateCommandTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastAction, setLastAction] = useState('');

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem('gateControlSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setAutoCloseTimeLimit(settings.autoCloseTimeLimit || 250);
          setRetryTimeLimit(settings.retryTimeLimit || 3);
          setOpenCheckTimeLimit(settings.openCheckTimeLimit || 10);
        }
      } catch (error) {
        console.error('❌ Error loading gate control settings:', error);
      }
    };

    loadSettings();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gateControlSettings') {
        loadSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle F5 refresh and force fresh user data
  useEffect(() => {
    const navigationEntries = performance.getEntriesByType('navigation');
    const isRefresh = navigationEntries.length > 0 && 
                     (navigationEntries[0] as any).type === 'reload';
    
    if (isRefresh && user) {
      console.log('🔄 F5 refresh detected, forcing fresh user data...');
      setUserLoading(true);
      
      const timeout = setTimeout(() => {
        window.location.reload();
      }, 100);
      
      return () => clearTimeout(timeout);
    } else if (user) {
      setUserLoading(false);
    }
  }, [user]);

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
    const isGateOpening = currentStatus.includes('otevírá se') || 
                         currentStatus.includes('opening') ||
                         currentStatus.includes('otevirá se') ||
                         currentStatus.includes('otevirá') ||
                         currentStatus.includes('otevreni') ||
                         originalStatus.includes('Otevírá se...') ||
                         originalStatus.includes('Opening...') ||
                         originalStatus.includes('OTEVIRA SE') ||
                         originalStatus.includes('Otevírá se') ||
                         originalStatus.includes('otevírá se') ||
                         originalStatus.includes('OTEVÍRÁ SE');
    const isGateClosing = currentStatus.includes('zavírání') || 
                         currentStatus.includes('zavirani') ||
                         currentStatus.includes('zavirá') ||
                         currentStatus.includes('zavírá se') ||
                         currentStatus.includes('zavira se') ||
                         currentStatus.includes('closing') ||
                         currentStatus.includes('Zavírá se');

    // Start countdown when gate opens
    if (isGateOpen && !autoCloseEnabled) {
      console.log('🚪 Gate opened - starting auto-close countdown');
      const openTime = Date.now();
      setAutoCloseEnabled(true);
      setAutoCloseCountdown(autoCloseTimeLimit);
      setGateOpenTime(openTime);
      setShowOpenDuration(false);
      
      const syncData = {
        autoCloseEnabled: true,
        autoCloseCountdown: autoCloseTimeLimit,
        gateOpenTime: openTime,
        showOpenDuration: false,
        currentTime: Date.now(),
        timestamp: Date.now()
      };
      localStorage.setItem('gateSync', JSON.stringify(syncData));
      window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));
    }
    
    // Stop countdown when gate closes
    if ((isGateClosed || isGateClosing) && autoCloseEnabled) {
      console.log('🚪 Gate closing/closed - stopping auto-close countdown');
      setAutoCloseEnabled(false);
      setAutoCloseCountdown(0);
      setGateOpenTime(0);
      setShowOpenDuration(false);
      
      const syncData = {
        autoCloseEnabled: false,
        autoCloseCountdown: 0,
        gateOpenTime: 0,
        showOpenDuration: false,
        currentTime: Date.now(),
        timestamp: Date.now()
      };
      localStorage.setItem('gateSync', JSON.stringify(syncData));
      window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));
    }
    
    // Reset retry state when gate status changes
    if (gateCommandRetry) {
      let resetTimer: NodeJS.Timeout;
      
      if (!mqttStatus.gateStatus?.toLowerCase().includes('zavřena') && 
          !mqttStatus.gateStatus?.toLowerCase().includes('closed')) {
        console.log('✅ Gate status changed, resetting retry state');
        setGateCommandRetry(false);
        if (gateCommandTimeout) {
          clearTimeout(gateCommandTimeout);
          setGateCommandTimeout(null);
        }
      } else {
        resetTimer = setTimeout(() => {
          console.log('⏰ Auto-resetting retry state after 5s');
          setGateCommandRetry(false);
          if (gateCommandTimeout) {
            clearTimeout(gateCommandTimeout);
            setGateCommandTimeout(null);
          }
        }, 5000);
      }
      
      return () => {
        if (resetTimer) clearTimeout(resetTimer);
      };
    }
  }, [mqttStatus.gateStatus, gateCommandRetry, gateCommandTimeout, autoCloseEnabled, autoCloseTimeLimit]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (gateCommandTimeout) {
        clearTimeout(gateCommandTimeout);
      }
    };
  }, [gateCommandTimeout]);

  const handleGateCommand = useCallback(async () => {
    if (!user) {
      console.log('❌ No user found - cannot send gate command');
      return;
    }

    if (!canControlGate(user)) {
      console.log('❌ User does not have permission to control gate');
      setLastAction('Nemáte oprávnění ovládat bránu');
      setTimeout(() => setLastAction(''), 3000);
      return;
    }

    console.log('🚪 Sending gate command...');
    setGateLoading(true);
    setGateCommandRetry(false);
    setLastAction('Odesílám příkaz brány...');
    
    try {
      const userIdentification = user.displayName || user.email;
      await optimizedMqttService.publishGateCommand(userIdentification);
      setLastAction('Příkaz odeslán - brána se otevírá');
    } catch (error) {
      console.error('❌ Error sending gate command:', error);
      setLastAction('Chyba při odesílání příkazu');
    } finally {
      setGateLoading(false);
      setTimeout(() => setLastAction(''), 3000);
    }
  }, [user]);

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

  return {
    // State
    gateLoading,
    autoCloseCountdown,
    autoCloseEnabled,
    openCheckCountdown,
    openCheckEnabled,
    gateOpenTime,
    showOpenDuration,
    currentTime,
    userLoading,
    autoCloseTimeLimit,
    retryTimeLimit,
    openCheckTimeLimit,
    gateCommandRetry,
    gateCommandTimeout,
    lastAction,
    
    // Actions
    handleGateCommand,
    formatCountdown,
    formatOpenDuration
  };
};

// Helper function
const canControlGate = (user: any) => {
  if (!user) return false;
  return ['admin', 'user'].includes(user.role);
};
