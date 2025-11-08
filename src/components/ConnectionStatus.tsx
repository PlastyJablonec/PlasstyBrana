import React from 'react';
import { IMqttStatus, IConnectionMetrics } from '../services/optimizedMqttService';

interface ConnectionStatusProps {
  status: IMqttStatus;
  metrics: IConnectionMetrics;
  isConnecting: boolean;
  onRefresh: () => Promise<void>;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  metrics,
  isConnecting,
  onRefresh
}) => {
  const getConnectionColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'poor': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionIcon = (isConnected: boolean) => {
    if (isConnecting) {
      return (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    }
    
    if (isConnected) {
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  };

  const formatLatency = (latency?: number) => {
    if (!latency) return 'N/A';
    return `${latency}ms`;
  };

  const formatUptime = (uptime: number) => {
    if (uptime === 0) return '0s';
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full ${getConnectionColor(status.connectionQuality)} text-white`}>
                {getConnectionIcon(status.isConnected)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {isConnecting ? 'Připojuji...' : status.isConnected ? 'Připojeno' : 'Odpojeno'}
                </p>
                <p className="text-xs text-gray-500">
                  {status.connectionType === 'direct' ? 'Direct MQTT' : 'HTTP Proxy'}
                </p>
              </div>
            </div>

            {/* Connection Quality */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Kvalita:</span>
              <span className={`text-sm font-medium ${
                status.connectionQuality === 'excellent' ? 'text-green-600' :
                status.connectionQuality === 'good' ? 'text-blue-600' :
                status.connectionQuality === 'poor' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {status.connectionQuality === 'excellent' ? 'Vynikající' :
                 status.connectionQuality === 'good' ? 'Dobrá' :
                 status.connectionQuality === 'poor' ? 'Špatná' :
                 'Odpojeno'}
              </span>
            </div>

            {/* Latency */}
            {status.isConnected && status.latency && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Latence:</span>
                <span className={`text-sm font-medium ${
                  status.latency < 100 ? 'text-green-600' :
                  status.latency < 500 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {formatLatency(status.latency)}
                </span>
              </div>
            )}

            {/* Success Rate */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Úspěšnost:</span>
              <span className="text-sm font-medium text-gray-900">
                {metrics.connectionAttempts > 0 
                  ? `${Math.round((metrics.successfulConnections / metrics.connectionAttempts) * 100)}%`
                  : 'N/A'
                }
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Metrics */}
            <div className="hidden md:flex items-center space-x-4 text-sm text-gray-600">
              <span>Zprávy: {metrics.messagesSent}/{metrics.messagesReceived}</span>
              <span>Uptime: {formatUptime(metrics.uptime)}</span>
              {metrics.averageConnectionTime > 0 && (
                <span>Prům. připojení: {Math.round(metrics.averageConnectionTime)}ms</span>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isConnecting}
              className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Obnovit</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {status.lastError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Chyba:</strong> {status.lastError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
