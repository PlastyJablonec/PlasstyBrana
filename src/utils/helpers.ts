import { GateStatusType, GarageStatusType } from '../services/optimizedMqttService';

// Date utilities
export const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

export const getRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'právě teď';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `před ${diffInMinutes} minutou${diffInMinutes > 1 ? 'mi' : ''}`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `před ${diffInHours} hodinou${diffInHours > 1 ? 'mi' : ''}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `před ${diffInDays} dnem${diffInDays > 1 ? 'i' : ''}`;
};

// Status utilities
export const getStatusColor = (status: GateStatusType | GarageStatusType): string => {
  if (status.includes('zavřena')) return '#22c55e';
  if (status.includes('otevřena')) return '#3b82f6';
  if (status.includes('otevírá') || status.includes('zavírá')) return '#f59e0b';
  if (status.includes('Zastavena') || status.includes('STOP')) return '#ef4444';
  return '#6b7280';
};

export const getStatusIcon = (status: GateStatusType | GarageStatusType): string => {
  if (status.includes('zavřena')) return '🔒';
  if (status.includes('otevřena')) return '🔓';
  if (status.includes('otevírá')) return '🔄';
  if (status.includes('zavírá')) return '🔄';
  if (status.includes('Zastavena') || status.includes('STOP')) return '🛑';
  return '❓';
};

export const isStatusActive = (status: GateStatusType | GarageStatusType): boolean => {
  return status.includes('otevírá') || status.includes('zavírá');
};

export const isStatusOpen = (status: GateStatusType | GarageStatusType): boolean => {
  return status.includes('otevřena');
};

export const isStatusClosed = (status: GateStatusType | GarageStatusType): boolean => {
  return status.includes('zavřena');
};

// Connection utilities
export const getConnectionQualityText = (quality: string): string => {
  switch (quality) {
    case 'excellent': return 'Vynikající';
    case 'good': return 'Dobrá';
    case 'poor': return 'Špatná';
    case 'disconnected': return 'Odpojeno';
    default: return 'Neznámá';
  }
};

export const getConnectionQualityColor = (quality: string): string => {
  switch (quality) {
    case 'excellent': return '#22c55e';
    case 'good': return '#3b82f6';
    case 'poor': return '#f59e0b';
    case 'disconnected': return '#ef4444';
    default: return '#6b7280';
  }
};

export const formatLatency = (latency: number): string => {
  if (latency < 1000) {
    return `${latency}ms`;
  }
  return `${(latency / 1000).toFixed(1)}s`;
};

export const getLatencyColor = (latency: number): string => {
  if (latency < 100) return '#22c55e';
  if (latency < 500) return '#f59e0b';
  return '#ef4444';
};

// String utilities
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const capitalizeFirst = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidMqttUrl = (url: string): boolean => {
  const mqttRegex = /^(ws|wss):\/\/[^\s/$.?#].[^\s]*$/;
  return mqttRegex.test(url);
};

// Error handling utilities
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Došlo k neznámé chybě';
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('network') || 
           error.message.includes('fetch') ||
           error.message.includes('connection');
  }
  return false;
};

// Local storage utilities
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch {
      return defaultValue || null;
    }
  },
  
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }
};

// Device detection
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isTablet = (): boolean => {
  return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
};

export const isDesktop = (): boolean => {
  return !isMobile() && !isTablet();
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait) as any;
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Random utilities
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const generateClientId = (): string => {
  return `gate-control-${Math.random().toString(16).substring(2, 8)}`;
};

// Color utilities
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Performance utilities
export const measurePerformance = (name: string, fn: () => void): number => {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`${name} took ${end - start} milliseconds`);
  return end - start;
};

export const asyncMeasurePerformance = async (name: string, fn: () => Promise<void>): Promise<number> => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  console.log(`${name} took ${end - start} milliseconds`);
  return end - start;
};
