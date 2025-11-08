import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserData } from '../types/user';
import { optimizedMqttService, IMqttStatus } from '../services/optimizedMqttService';

interface AppContextType {
  user: UserData | null;
  mqttStatus: IMqttStatus;
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
  user: UserData | null;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, user }) => {
  const [mqttStatus, setMqttStatus] = useState<IMqttStatus>(optimizedMqttService.getStatus());
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Update status periodically
    const interval = setInterval(() => {
      setMqttStatus(optimizedMqttService.getStatus());
    }, 1000);

    // Initialize connection if user is logged in
    if (user) {
      optimizedMqttService.connect().catch((error) => {
        console.error('Failed to initialize MQTT connection:', error);
        setConnectionError('Nepodařilo se připojit k MQTT serveru');
      });
    }

    return () => clearInterval(interval);
  }, [user]);

  const contextValue: AppContextType = {
    user,
    mqttStatus,
    connectionError,
    setConnectionError,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
