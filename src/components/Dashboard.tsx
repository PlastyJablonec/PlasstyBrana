import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { auth, db } from '../firebase/config';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { hasPermission, canControlGarage, canUseStopMode } from '../types/user';
import { optimizedMqttService } from '../services/optimizedMqttService';
import LoadingSpinner from './LoadingSpinner';
import DashboardHeader from './DashboardHeader';

interface ControlCard {
  id: string;
  title: string;
  icon: string;
  color: string;
  status?: string | null;
  action: () => void;
  loading: boolean;
  description: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, mqttStatus } = useAppContext();
  const mqttStatusRef = useRef(mqttStatus);
  mqttStatusRef.current = mqttStatus;
  
  const [lastAction, setLastAction] = useState<string>('');
  const [garageLoading, setGarageLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  
  // Gate status tracking state
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [gateOpenTime, setGateOpenTime] = useState(0);
  const [showOpenDuration, setShowOpenDuration] = useState(false);
  const [timeAfterLimit, setTimeAfterLimit] = useState(0);
  const [openCheckCountdown, setOpenCheckCountdown] = useState(0);
  const [openCheckEnabled, setOpenCheckEnabled] = useState(false);
  const [autoCloseTimeLimit, setAutoCloseTimeLimit] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings from Firestore on mount and listen for real-time updates
  useEffect(() => {
    const loadAndMigrateSettings = async () => {
      try {
        // STEP 1: Check if we have old localStorage data and migrate it
        const localSettings = localStorage.getItem('gateControlSettings');
        if (localSettings) {
          console.log('🔄 Found old localStorage settings, migrating to Firestore...');
          const parsedSettings = JSON.parse(localSettings);
          
          // Save to new Firestore document
          const { setDoc, doc } = await import('firebase/firestore');
          await setDoc(doc(db, 'settings', 'ovladaniBrany'), {
            autoCloseTimeLimit: parsedSettings.autoCloseTimeLimit || 250,
            retryTimeLimit: parsedSettings.retryTimeLimit || 3,
            openCheckTimeLimit: parsedSettings.openCheckTimeLimit || 10,
            savedAt: new Date().toISOString(),
            savedBy: user?.email || 'migration',
            migratedFrom: 'localStorage'
          });
          
          console.log('✅ Settings migrated from localStorage to Firestore');
          
          // Clear old localStorage
          localStorage.removeItem('gateControlSettings');
        }
        
        // STEP 2: Load settings from Firestore
        const settingsDoc = await getDoc(doc(db, 'settings', 'ovladaniBrany'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          if (settings.autoCloseTimeLimit) {
            setAutoCloseTimeLimit(settings.autoCloseTimeLimit);
            console.log('📥 Loaded autoCloseTimeLimit from Firestore:', settings.autoCloseTimeLimit);
          }
        }
        setSettingsLoaded(true); // Mark settings as loaded
      } catch (error) {
        console.error('❌ Error loading/migrating settings:', error);
        setSettingsLoaded(true); // Mark as loaded even on error to prevent blocking
      }
    };

    loadAndMigrateSettings();

    // Real-time listener for settings changes
    const unsubscribe = onSnapshot(doc(db, 'settings', 'ovladaniBrany'), (doc) => {
      if (doc.exists()) {
        const settings = doc.data();
        if (settings.autoCloseTimeLimit) {
          setAutoCloseTimeLimit(settings.autoCloseTimeLimit);
          console.log('🔄 Settings updated from Firestore:', settings.autoCloseTimeLimit);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
      // Auth context will handle redirect
    } catch (error) {
      console.error('❌ Error signing out:', error);
    }
  }, []);

  // Navigate to admin
  const handleNavigateToAdmin = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  // Handle gate command
  const handleGateCommand = useCallback(async () => {
    if (!user) {
      console.log('❌ No user found - cannot send gate command');
      return;
    }

    // Check current gate status to determine action
    const currentStatus = mqttStatus.gateStatus?.toLowerCase() || '';
    const isGateClosed = currentStatus.includes('zavřena') || currentStatus.includes('closed');
    
    console.log('🚪 Sending gate command...');
    setGateLoading(true);
    setLastAction('Odesílám příkaz brány...');
    
    try {
      const userIdentification = user.displayName || user.email;
      await optimizedMqttService.publishGateCommand(userIdentification);
      
      if (isGateClosed) {
        setLastAction('Příkaz odeslán - čekám na otevření...');
        
        // Start open check countdown after 1 second ONLY if gate was closed
        setTimeout(() => {
          setLastAction('Hlídám otevření brány...');
          setOpenCheckEnabled(true);
          setOpenCheckCountdown(10); // 10 seconds
          console.log('🔵 Starting open check countdown: 10s');
        }, 1000);
      } else {
        setLastAction('Příkaz pro zavření odeslán...');
        // Don't start open check when closing
      }
      
    } catch (error) {
      console.error('❌ Error sending gate command:', error);
      setLastAction('Chyba při odesílání příkazu');
    } finally {
      setGateLoading(false);
      setTimeout(() => setLastAction(''), 3000);
    }
  }, [user, mqttStatus.gateStatus]);

  // Handle garage gate
  const handleGarageGate = useCallback(async () => {
    if (!user) {
      console.log('❌ No user found - cannot send garage command');
      return;
    }

    if (!canControlGarage(user)) {
      console.log('❌ User does not have permission to control garage');
      setLastAction('Nemáte oprávnění ovládat garáž');
      setTimeout(() => setLastAction(''), 3000);
      return;
    }

    console.log('🚗 Sending garage gate command...');
    setGarageLoading(true);
    setLastAction('Odesílám příkaz garáže...');
    
    try {
      // TODO: Implement garage gate command
      setLastAction('Příkaz garáže odeslán');
    } catch (error) {
      console.error('❌ Error sending garage command:', error);
      setLastAction('Chyba při odesílání příkazu garáže');
    } finally {
      setGarageLoading(false);
      setTimeout(() => setLastAction(''), 3000);
    }
  }, [user]);

  // Handle stop mode
  const handleStopMode = useCallback(async () => {
    if (!user) {
      console.log('❌ No user found - cannot send stop command');
      return;
    }

    if (!canUseStopMode(user)) {
      console.log('❌ User does not have permission to use stop mode');
      setLastAction('Nemáte oprávnění pro STOP režim');
      setTimeout(() => setLastAction(''), 3000);
      return;
    }

    console.log('🛑 Sending stop command...');
    setStopLoading(true);
    setLastAction('Odesílám STOP příkaz...');
    
    try {
      // TODO: Implement stop command - blocks auto-close
      setLastAction('STOP režim aktivován - brána nezavře');
    } catch (error) {
      console.error('❌ Error sending stop command:', error);
      setLastAction('Chyba při odesílání STOP příkazu');
    } finally {
      setStopLoading(false);
      setTimeout(() => setLastAction(''), 3000);
    }
  }, [user]);

  // Load state from localStorage AFTER settings are loaded from Firestore
  useEffect(() => {
    // Wait for settings to be loaded from Firestore first
    if (!settingsLoaded) {
      console.log('⏳ Waiting for settings to load from Firestore...');
      return;
    }

    try {
      const savedSync = localStorage.getItem('gateSync');
      if (savedSync) {
        const data = JSON.parse(savedSync);
        console.log('📥 Loading gate state from localStorage with timeLimit:', autoCloseTimeLimit, data);
        
        // Check if gate is still open
        if (data.gateOpenTime && data.gateOpenTime > 0) {
          const elapsedSeconds = Math.floor((Date.now() - data.gateOpenTime) / 1000);
          
          if (elapsedSeconds < autoCloseTimeLimit) {
            // Still in countdown phase
            const remainingSeconds = autoCloseTimeLimit - elapsedSeconds;
            setAutoCloseEnabled(true);
            setAutoCloseCountdown(remainingSeconds);
            setGateOpenTime(data.gateOpenTime);
            setShowOpenDuration(false);
            setTimeAfterLimit(0);
            console.log(`⏱️ Restored countdown: ${remainingSeconds}s remaining (limit: ${autoCloseTimeLimit}s)`);
          } else {
            // Past the limit - show open duration
            const secondsAfterLimit = elapsedSeconds - autoCloseTimeLimit;
            setAutoCloseEnabled(false);
            setAutoCloseCountdown(0);
            setGateOpenTime(data.gateOpenTime);
            setShowOpenDuration(true);
            setTimeAfterLimit(secondsAfterLimit);
            console.log(`⏱️ Restored open duration: ${autoCloseTimeLimit + secondsAfterLimit}s total (limit: ${autoCloseTimeLimit}s)`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading gate sync from localStorage:', error);
    }
  }, [settingsLoaded, autoCloseTimeLimit]);

  // Main gate status tracking useEffect
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
    const isGateClosing = currentStatus.includes('zavírání') || currentStatus.includes('closing') ||
                         currentStatus.includes('zavirani') || originalStatus.includes('Zavírá se...');

    // CRITICAL: If gate is closing, STOP all open check processes
    if (isGateClosing && openCheckEnabled) {
      console.log('🔴 Gate is closing - STOPPING open check process');
      setOpenCheckEnabled(false);
      setOpenCheckCountdown(0);
      setLastAction('Brána se zavírá - kontrola otevření zastavena');
      setTimeout(() => setLastAction(''), 3000);
      return;
    }

    // Start countdown when gate opens
    if (isGateOpen && !autoCloseEnabled && !showOpenDuration && gateOpenTime === 0) {
      console.log('🚪 Gate opened - starting auto-close countdown');
      const openTime = Date.now();
      setAutoCloseEnabled(true);
      setAutoCloseCountdown(autoCloseTimeLimit);
      setGateOpenTime(openTime);
      
      // Sync with other users
      const syncData = { 
        autoCloseEnabled: true, 
        autoCloseCountdown: autoCloseTimeLimit, 
        gateOpenTime: openTime,
        showOpenDuration: false,
        timeAfterLimit: 0,
        timestamp: Date.now() 
      };
      localStorage.setItem('gateSync', JSON.stringify(syncData));
      window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));
    }
    
    // Stop countdown when gate closes
    if ((isGateClosed || isGateClosing) && (autoCloseEnabled || showOpenDuration)) {
      console.log('🚪 Gate closing/closed - stopping auto-close countdown');
      setAutoCloseEnabled(false);
      setAutoCloseCountdown(0);
      setGateOpenTime(0);
      setShowOpenDuration(false);
      setTimeAfterLimit(0);
      
      const syncData = { 
        autoCloseEnabled: false, 
        autoCloseCountdown: 0, 
        gateOpenTime: 0,
        showOpenDuration: false,
        timeAfterLimit: 0,
        timestamp: Date.now() 
      };
      localStorage.setItem('gateSync', JSON.stringify(syncData));
      window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));
    }
  }, [mqttStatus.gateStatus, autoCloseEnabled, showOpenDuration, autoCloseTimeLimit]);

  // Auto-close countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoCloseEnabled) {
      interval = setInterval(() => {
        setAutoCloseCountdown(prev => {
          if (prev <= 1) {
            // When countdown reaches 0, switch to "open duration" mode
            console.log('⏱️ Auto-close limit reached - switching to open duration display');
            setAutoCloseEnabled(false);
            setShowOpenDuration(true);
            setTimeAfterLimit(0); // Start counting from 0
            
            // Sync the switch to open duration mode
            const syncData = { 
              autoCloseEnabled: false, 
              autoCloseCountdown: 0, 
              gateOpenTime: gateOpenTime,
              showOpenDuration: true,
              timeAfterLimit: 0,
              timestamp: Date.now() 
            };
            localStorage.setItem('gateSync', JSON.stringify(syncData));
            window.dispatchEvent(new CustomEvent('gateSync', { detail: syncData }));
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [autoCloseEnabled, gateOpenTime]);

  // Count time after limit reached
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showOpenDuration) {
      interval = setInterval(() => {
        setTimeAfterLimit(prev => prev + 1);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [showOpenDuration]);

  
  // Open check countdown
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;
    let countdownInterval: NodeJS.Timeout | null = null;
    
    if (openCheckEnabled && openCheckCountdown > 0) {
      let checkCount = 0;
      const maxChecks = Math.ceil(openCheckCountdown / 0.5);
      
      // Countdown display interval (1s)
      countdownInterval = setInterval(() => {
        setOpenCheckCountdown(prev => {
          if (prev <= 1) {
            setOpenCheckEnabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Status check interval (500ms)
      checkInterval = setInterval(() => {
        checkCount++;
        console.log(`🔍 Real-time status check (${checkCount}/${maxChecks})...`);
        
        const freshStatus = mqttStatusRef.current.gateStatus || '';
        const currentStatus = freshStatus?.toLowerCase() || '';
        const originalStatus = freshStatus || '';
        const isGateOpening = currentStatus.includes('otevírá se') || currentStatus.includes('opening') ||
                              currentStatus.includes('otevirá se') || currentStatus.includes('otevirá') ||
                              currentStatus.includes('otevreni') || originalStatus.includes('Otevírá se...') ||
                              originalStatus.includes('Opening...') || originalStatus.includes('OTEVIRA SE') ||
                              originalStatus.includes('Otevírá se') || originalStatus.includes('otevírá se') ||
                              originalStatus.includes('OTEVÍRÁ SE');

        console.log('🔍 Real-time status check:', {
          originalStatus,
          currentStatus,
          isGateOpening,
          checkCount,
          note: 'Using FRESH mqttStatus data'
        });

        if (isGateOpening) {
          console.log(' Gate started opening - stopping check countdown');
          if (checkInterval) clearInterval(checkInterval);
          if (countdownInterval) clearInterval(countdownInterval);
          setOpenCheckEnabled(false);
          setOpenCheckCountdown(0);
          setLastAction('Brána se otevírá...');
          setTimeout(() => setLastAction(''), 3000);
        } else if (checkCount >= maxChecks) {
          console.log(' Time limit reached - gate did not start opening, retrying command...');
          if (checkInterval) clearInterval(checkInterval);
          if (countdownInterval) clearInterval(countdownInterval);
          setOpenCheckEnabled(false);
          setOpenCheckCountdown(0);
          
          // Automatic retry - send second gate command
          setLastAction('Provádím druhý pokus o otevření...');
          
          // Retry the gate command
          setTimeout(async () => {
            try {
              const userIdentification = user?.displayName || user?.email;
              if (userIdentification) {
                await optimizedMqttService.publishGateCommand(userIdentification);
                console.log('🔄 Retry gate command sent');
                setLastAction('Druhý pokus odeslán - čekám na otevření...');
                
                // Start second open check
                setTimeout(() => {
                  setLastAction('Hlídám otevření brány (druhý pokus)...');
                  setOpenCheckEnabled(true);
                  setOpenCheckCountdown(10);
                  console.log('🔵 Starting SECOND open check countdown: 10s');
                }, 1000);
              }
            } catch (error) {
              console.error('❌ Error in retry gate command:', error);
              setLastAction('Chyba při druhém pokusu');
              setTimeout(() => setLastAction(''), 3000);
            }
          }, 1000);
        }
      }, 500);
    }
    
    return () => { 
      if (checkInterval) clearInterval(checkInterval);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [openCheckEnabled, openCheckCountdown]);

  
  // Helper functions
  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (minutes > 0) return `${minutes}:${secs.toString().padStart(2, '0')}`;
    return `${secs}s`;
  };

  const formatTotalOpenTime = (secondsAfterLimit: number) => {
    // Total time = configured limit + time after limit
    const totalSeconds = autoCloseTimeLimit + secondsAfterLimit;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (minutes > 0) return `${minutes}:${secs.toString().padStart(2, '0')}`;
    return `${secs}s`;
  };

  
  // Control cards data
  const controlCards: ControlCard[] = [
    {
      id: 'gate',
      title: 'Brána',
      icon: '🚪',
      color: 'blue',
      status: mqttStatus.gateStatus,
      action: handleGateCommand,
      loading: gateLoading,
      description: 'Ovládání hlavní brány'
    },
    {
      id: 'garage',
      title: 'Garáž',
      icon: '🚗',
      color: 'green',
      status: mqttStatus.garageStatus || 'Neznámý stav',
      action: handleGarageGate,
      loading: garageLoading,
      description: 'Ovládání garážové brány'
    },
    {
      id: 'stop',
      title: 'STOP',
      icon: '🛑',
      color: 'red',
      status: null,
      action: handleStopMode,
      loading: stopLoading,
      description: 'Blokovat automatické zavření'
    }
  ];

  // Filter cards based on user permissions
  const filteredCards = controlCards.filter(card => {
    if (card.id === 'gate') return true; // Always show gate
    if (card.id === 'garage') return canControlGarage(user);
    if (card.id === 'stop') return canUseStopMode(user);
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <DashboardHeader
        onLogout={handleLogout}
        onNavigateToAdmin={handleNavigateToAdmin}
      />

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status message */}
        {lastAction && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center space-x-2">
              <span className="text-blue-600">ℹ️</span>
              <span className="text-sm font-medium text-blue-800">
                {lastAction}
              </span>
            </div>
          </div>
        )}

        {/* Open check countdown - BLUE */}
        {openCheckEnabled && openCheckCountdown > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">🔵</span>
                <span className="text-sm font-medium text-blue-800">
                  Kontrola otevření:
                </span>
              </div>
              <span className="text-lg font-bold text-blue-900">
                {openCheckCountdown}s
              </span>
            </div>
          </div>
        )}

        {/* Auto-close countdown - ORANGE (zobrazí se POUZE když není showOpenDuration) */}
        {!showOpenDuration && autoCloseEnabled && autoCloseCountdown > 0 && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-orange-600">🟠</span>
                <span className="text-sm font-medium text-orange-800">
                  Auto zavření:
                </span>
              </div>
              <span className="text-lg font-bold text-orange-900">
                {formatCountdown(autoCloseCountdown)}
              </span>
            </div>
          </div>
        )}

        {/* Open duration display - GREEN (zobrazí se POUZE když není autoCloseEnabled) */}
        {showOpenDuration && !autoCloseEnabled && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-green-600">⏱️</span>
                <span className="text-sm font-medium text-green-800">
                  Brána je otevřena již:
                </span>
              </div>
              <span className="text-lg font-bold text-green-900">
                {formatTotalOpenTime(timeAfterLimit)}
              </span>
            </div>
          </div>
        )}

        
        {/* Control cards grid */}
        {filteredCards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{card.icon}</span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {card.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </div>

                {card.status && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">
                      Stav: {card.status}
                    </p>
                  </div>
                )}

                <button
                  onClick={card.action}
                  disabled={card.loading}
                  className={`w-full px-4 py-3 bg-gradient-to-r from-${card.color}-500 to-${card.color}-600 text-white rounded-xl hover:from-${card.color}-600 hover:to-${card.color}-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:shadow-none`}
                >
                  {card.loading ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Ovládat</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Connection status */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${mqttStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-sm font-medium text-gray-700">
                MQTT Status: {mqttStatus.isConnected ? 'Připojeno' : 'Odpojeno'}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Poslední aktualizace: {new Date().toLocaleTimeString('cs-CZ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
