// Re-export MQTT types for easier access
export type {
  GateStatusType,
  GarageStatusType,
  IMqttStatus,
  IMqttConnectionOptions,
  IActivityLog,
  IGateLogEntry,
  IConnectionMetrics
} from '../services/optimizedMqttService';

export type {
  IHttpMqttConfig,
  IConnectionStats
} from '../services/optimizedHttpMqttService';

import { ReactNode } from 'react';

// Additional app types
export interface IUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
}

export interface IAppState {
  user: IUser | null;
  loading: boolean;
  error: string | null;
}

export interface IComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface IButtonProps extends IComponentProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'small' | 'medium' | 'large';
  type?: 'button' | 'submit' | 'reset';
}

export interface ICardProps extends IComponentProps {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}

export interface IStatusIndicator {
  status: 'online' | 'offline' | 'warning' | 'loading';
  text?: string;
  showIcon?: boolean;
}

export interface INotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface IConfig {
  mqtt: {
    url: string;
    wssUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
  };
  camera: {
    url: string;
  };
  polling: {
    interval: number;
    hiddenInterval: number;
  };
}

export interface IDeviceStatus {
  gate: {
    status: string;
    lastUpdate: Date;
    batteryLevel?: number;
  };
  garage: {
    status: string;
    lastUpdate: Date;
    batteryLevel?: number;
  };
}

export interface IActivityHistory {
  id: string;
  user: string;
  action: string;
  device: 'gate' | 'garage';
  timestamp: Date;
  success: boolean;
}

export interface ISystemInfo {
  version: string;
  buildNumber: string;
  lastUpdate: Date;
  uptime: number;
  memoryUsage: number;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
