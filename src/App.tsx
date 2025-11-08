import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { userService } from './services/userService';
import { optimizedMqttService } from './services/optimizedMqttService';
import { IMqttStatus, IConnectionMetrics } from './services/optimizedMqttService';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import UserPermissions from './components/UserPermissions';
import ConnectionStatus from './components/ConnectionStatus';
import LoadingSpinner from './components/LoadingSpinner';
import { AppProvider } from './contexts/AppContext';

// Styles
import './App.css';

// Types
import { UserData } from './types/user';

interface AppContextType {
  user: UserData | null;
  mqttStatus: IMqttStatus;
  connectionMetrics: IConnectionMetrics;
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;
  logout: () => Promise<void>;
}

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [mqttStatus, setMqttStatus] = useState<IMqttStatus>(optimizedMqttService.getStatus());
  const [connectionMetrics, setConnectionMetrics] = useState<IConnectionMetrics>(optimizedMqttService.getMetrics());

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get user data from Firestore
          const userData = await userService.getCurrentUser();
          if (userData) {
            // Update last login timestamp
            await userService.updateLastLogin(firebaseUser.uid);
            
            // Refresh user data to get updated lastLogin
            const updatedUserData = await userService.getCurrentUser();
            setUser(updatedUserData);
            
            // Connect to MQTT
            await optimizedMqttService.connect();
          } else {
            console.error('User data not found in Firestore');
            setUser(null);
          }
        } else {
          setUser(null);
          await optimizedMqttService.disconnect();
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle MQTT status changes
  useEffect(() => {
    // Update status periodically
    const interval = setInterval(() => {
      setMqttStatus(optimizedMqttService.getStatus());
      setConnectionMetrics(optimizedMqttService.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle logout
  const logout = useCallback(async () => {
    try {
      await optimizedMqttService.disconnect();
      await auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const contextValue: AppContextType = {
    user,
    mqttStatus,
    connectionMetrics,
    connectionError,
    setConnectionError,
    logout,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" color="primary" />
          <p className="mt-4 text-gray-600">Načítám aplikaci...</p>
        </div>
      </div>
    );
  }

  return (
    <AppProvider user={user}>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <Routes>
            <Route 
              path="/login" 
              element={user ? <Navigate to="/" replace /> : <Login />} 
            />
            <Route 
              path="/" 
              element={user ? <Dashboard /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/admin" 
              element={user ? <AdminPanel /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/admin/permissions/:userId" 
              element={user ? <UserPermissions /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="*" 
              element={<Navigate to="/" replace />} 
            />
          </Routes>

          {/* Global Error Display */}
          {connectionError && (
            <div className="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg max-w-md z-50">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{connectionError}</span>
              </div>
              <button 
                onClick={() => setConnectionError(null)}
                className="absolute top-1 right-1 text-white hover:text-gray-200"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

                  </div>
      </Router>
    </AppProvider>
  );
};

export default App;
