import { GateStatusType, GarageStatusType, IMqttStatus, IActivityLog, IGateLogEntry } from './optimizedMqttService';
import { db } from '../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

type StatusCallback = (status: IMqttStatus) => void;
type GateLogCallback = (logEntry: IGateLogEntry) => void;
type UnsubscribeFunction = () => void;

export interface IHttpMqttConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCaching: boolean;
  cacheTimeout: number;
}

export interface IConnectionStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date | null;
  uptime: number;
}

class RequestCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private defaultTimeout: number = 5000;

  set(key: string, data: any, timeout?: number): void {
    const cacheTimeout = timeout || this.defaultTimeout;
    this.cache.set(key, {
      data,
      timestamp: Date.now() + cacheTimeout
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    this.cache.forEach((item, key) => {
      if (now > item.timestamp) {
        this.cache.delete(key);
      }
    });
  }
}

class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000,
    private monitoringPeriod: number = 10000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log('✅ Circuit breaker returning to CLOSED state');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log('🚨 Circuit breaker opening due to failures');
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

export class OptimizedHttpMqttService {
  private statusCallbacks: StatusCallback[] = [];
  private gateLogCallbacks: GateLogCallback[] = [];
  private currentStatus: IMqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Neznámý stav',
    isConnected: false,
    rawGateStatus: null,
    rawGarageStatus: null,
    connectionQuality: 'disconnected',
    connectionType: 'http-proxy'
  };
  
  private statusPollingInterval: number | null = null;
  private isStatusPolling = false;
  private shouldPoll = false;
  private pendingImmediatePoll = false;
  private visibilityListenerAttached = false;
  
  private readonly basePollIntervalMs = 7000;
  private readonly hiddenPollIntervalMs = 20000;
  private lastGateLogMessage: string | null = null;
  
  private requestCache: RequestCache = new RequestCache();
  private circuitBreaker: CircuitBreaker = new CircuitBreaker();
  private connectionStats: IConnectionStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: null,
    uptime: 0
  };
  
  private readonly config: IHttpMqttConfig = {
    baseUrl: '/api/mqtt-proxy',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    enableCaching: true,
    cacheTimeout: 3000
  };

  private readonly visibilityChangeHandler = () => {
    if (!this.shouldPoll || typeof document === 'undefined') {
      return;
    }
    if (document.hidden) {
      this.scheduleStatusPoll(this.hiddenPollIntervalMs);
    } else {
      this.scheduleStatusPoll(0);
    }
  };

  constructor() {
    // Start cache cleanup interval
    setInterval(() => {
      this.requestCache.cleanup();
    }, 60000);
  }

  public async connect(): Promise<void> {
    console.log('🌐 Optimized HTTP MQTT Service: Connecting via proxy...');

    try {
      await this.testConnection();
      
      this.currentStatus.isConnected = true;
      this.currentStatus.connectionQuality = 'good';
      this.currentStatus.lastError = undefined;
      this.notifyStatusChange();

      await this.fetchStatusOnce();
      this.startStatusPolling();

      setTimeout(async () => {
        await this.forceCheckGateLogMessage();
      }, 1000);

      console.log('✅ Optimized HTTP MQTT Service: Connected via proxy');
    } catch (error) {
      console.error('❌ Optimized HTTP MQTT Service: Connection failed:', error);
      this.currentStatus.isConnected = false;
      this.currentStatus.connectionQuality = 'disconnected';
      this.currentStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.notifyStatusChange();
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      const startTime = Date.now();
      
      const response = await fetch(this.config.baseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      this.updateConnectionStats(responseTime, true);

      if (!response.ok) {
        throw new Error(`Proxy connection failed: ${response.status} ${response.statusText}`);
      }

      const status = await response.json();
      console.log('🌐 HTTP MQTT Proxy status:', status);
    });
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      const startTime = Date.now();
      
      // Check cache first for GET requests
      if (this.config.enableCaching && (!options.method || options.method === 'GET')) {
        const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
        const cached = this.requestCache.get(cacheKey);
        if (cached) {
          console.log('📦 Using cached response for:', endpoint);
          return cached;
        }
      }

      const url = `${this.config.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GateControl-Optimized/1.0',
          ...options.headers
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      this.updateConnectionStats(responseTime, response.ok);

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful GET requests
      if (this.config.enableCaching && (!options.method || options.method === 'GET')) {
        const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
        this.requestCache.set(cacheKey, data, this.config.cacheTimeout);
      }

      return data;
    });
  }

  private updateConnectionStats(responseTime: number, success: boolean): void {
    this.connectionStats.totalRequests++;
    this.connectionStats.lastRequestTime = new Date();
    
    if (success) {
      this.connectionStats.successfulRequests++;
      this.updateAverageResponseTime(responseTime);
    } else {
      this.connectionStats.failedRequests++;
    }

    this.updateConnectionQuality();
  }

  private updateAverageResponseTime(responseTime: number): void {
    const total = this.connectionStats.successfulRequests;
    if (total === 1) {
      this.connectionStats.averageResponseTime = responseTime;
    } else {
      this.connectionStats.averageResponseTime = 
        (this.connectionStats.averageResponseTime * (total - 1) + responseTime) / total;
    }
  }

  private updateConnectionQuality(): void {
    const successRate = this.connectionStats.totalRequests > 0 
      ? this.connectionStats.successfulRequests / this.connectionStats.totalRequests 
      : 0;

    if (successRate >= 0.95 && this.connectionStats.averageResponseTime < 1000) {
      this.currentStatus.connectionQuality = 'excellent';
    } else if (successRate >= 0.85 && this.connectionStats.averageResponseTime < 3000) {
      this.currentStatus.connectionQuality = 'good';
    } else if (successRate >= 0.7) {
      this.currentStatus.connectionQuality = 'poor';
    } else {
      this.currentStatus.connectionQuality = 'disconnected';
    }
  }

  private startStatusPolling(): void {
    console.log(`🔄 Optimized HTTP MQTT Service: Starting status polling (base ${this.basePollIntervalMs}ms, hidden ${this.hiddenPollIntervalMs}ms)...`);
    this.shouldPoll = true;
    this.attachVisibilityListener();
    this.scheduleStatusPoll();
  }

  private stopStatusPolling(): void {
    this.shouldPoll = false;
    if (this.statusPollingInterval) {
      clearTimeout(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
    this.isStatusPolling = false;
    this.pendingImmediatePoll = false;
    this.detachVisibilityListener();
  }

  private scheduleStatusPoll(customDelay?: number): void {
    if (!this.shouldPoll) {
      return;
    }

    if (this.statusPollingInterval) {
      clearTimeout(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }

    const delay = typeof customDelay === 'number' ? customDelay : this.getCurrentPollInterval();
    this.statusPollingInterval = setTimeout(() => {
      this.pollStatus().catch((error) => {
        console.error('❌ HTTP MQTT Service: Polling error:', error);
        if (this.currentStatus.isConnected) {
          console.warn('⚠️ HTTP MQTT: Polling error, marking as disconnected:', error);
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
        }
        if (this.shouldPoll) {
          this.scheduleStatusPoll();
        }
      });
    }, Math.max(0, delay)) as any;
  }

  private getCurrentPollInterval(): number {
    if (typeof document === 'undefined') {
      return this.basePollIntervalMs;
    }
    return document.hidden ? this.hiddenPollIntervalMs : this.basePollIntervalMs;
  }

  private async pollStatus(): Promise<void> {
    if (!this.shouldPoll) {
      return;
    }

    if (this.isStatusPolling) {
      this.pendingImmediatePoll = true;
      return;
    }

    this.isStatusPolling = true;
    this.pendingImmediatePoll = false;

    try {
      const status = await this.makeRequest<any>('', {
        method: 'GET'
      });

      const wasConnected = this.currentStatus.isConnected;
      let statusChanged = false;

      this.currentStatus.isConnected = status.connected || false;
      if (wasConnected !== this.currentStatus.isConnected) {
        console.log(`🔄 HTTP MQTT: Connection status changed: ${this.currentStatus.isConnected}`);
        statusChanged = true;
      }

      if (status.messages) {
        const rawGateStatus = status.messages['IoT/Brana/Status'] ?? null;
        const rawGarageStatus = status.messages['IoT/Brana/Status2'] ?? null;
        this.currentStatus.rawGateStatus = rawGateStatus;
        this.currentStatus.rawGarageStatus = rawGarageStatus;
        
        const oldGateStatus = this.currentStatus.gateStatus;
        const oldGarageStatus = this.currentStatus.garageStatus;

        if (status.messages['IoT/Brana/Status']) {
          const parsedStatus = this.parseGateStatus(status.messages['IoT/Brana/Status']);
          console.log(`🚪 HTTP MQTT DEBUG: Raw: "${status.messages['IoT/Brana/Status']}" → Parsed: "${parsedStatus}"`);
          this.currentStatus.gateStatus = parsedStatus;
          if (oldGateStatus !== this.currentStatus.gateStatus) {
            console.log(`🚪 HTTP MQTT: Gate status CHANGED: ${oldGateStatus} → ${this.currentStatus.gateStatus}`);
            statusChanged = true;
          }
        }

        if (status.messages['IoT/Brana/Status2']) {
          this.currentStatus.garageStatus = this.parseGarageStatus(status.messages['IoT/Brana/Status2']);
          if (oldGarageStatus !== this.currentStatus.garageStatus) {
            console.log(`🏠 HTTP MQTT: Garage status: ${oldGarageStatus} → ${this.currentStatus.garageStatus}`);
            statusChanged = true;
          }
        }

        if (status.messages['Log/Brana/ID']) {
          const newLogMessage = status.messages['Log/Brana/ID'];
          if (this.lastGateLogMessage !== newLogMessage) {
            console.log(`🎯 HTTP MQTT: New Log/Brana/ID message: "${this.lastGateLogMessage}" → "${newLogMessage}"`);
            this.lastGateLogMessage = newLogMessage;
            this.handleGateLogMessage(newLogMessage);
          }
        }
      } else if (this.currentStatus.isConnected) {
        console.warn('🚨 HTTP MQTT: Proxy connected but NO MESSAGES!');
      }

      if (statusChanged) {
        console.log('🔔 HTTP MQTT: Status changed, notifying callbacks...');
        this.notifyStatusChange();
      }
    } catch (error) {
      console.error('❌ HTTP MQTT Service: Polling error:', error);
      if (this.currentStatus.isConnected) {
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
      }
    } finally {
      this.isStatusPolling = false;
      if (this.pendingImmediatePoll && this.shouldPoll) {
        this.scheduleStatusPoll(100);
      }
    }
  }

  private async fetchStatusOnce(): Promise<void> {
    try {
      const status = await this.makeRequest<any>('', {
        method: 'GET'
      });

      this.currentStatus.isConnected = status.connected || false;

      if (status.messages) {
        if (status.messages['IoT/Brana/Status']) {
          this.currentStatus.rawGateStatus = status.messages['IoT/Brana/Status'];
          this.currentStatus.gateStatus = this.parseGateStatus(status.messages['IoT/Brana/Status']);
        }

        if (status.messages['IoT/Brana/Status2']) {
          this.currentStatus.rawGarageStatus = status.messages['IoT/Brana/Status2'];
          this.currentStatus.garageStatus = this.parseGarageStatus(status.messages['IoT/Brana/Status2']);
        }
      }
    } catch (error) {
      console.error('❌ HTTP MQTT Service: Initial status fetch failed:', error);
    }
  }

  private async forceCheckGateLogMessage(): Promise<void> {
    try {
      const status = await this.makeRequest<any>('', {
        method: 'GET'
      });

      if (status.messages && status.messages['Log/Brana/ID']) {
        const logMessage = status.messages['Log/Brana/ID'];
        if (this.lastGateLogMessage !== logMessage) {
          console.log(`🎯 HTTP MQTT: Initial Log/Brana/ID message: "${logMessage}"`);
          this.lastGateLogMessage = logMessage;
          this.handleGateLogMessage(logMessage);
        }
      }
    } catch (error) {
      console.error('❌ HTTP MQTT Service: Gate log check failed:', error);
    }
  }

  private parseGateStatus(status: string): GateStatusType {
    const cleanStatus = status.trim();

    const statusMap: Record<string, GateStatusType> = {
      'Brána zavřena': 'Brána zavřena',
      'Brána otevřena': 'Brána otevřena',
      'Otevírá se...': 'Otevírá se...',
      'Zavírá se...': 'Zavírá se...',
      'Zastavena': 'Zastavena',
      'STOP režim': 'STOP režim',
      'P1': 'Brána zavřena',
      'P2': 'Brána otevřena',
      'P3': 'Otevírá se...',
      'P4': 'Zavírá se...',
      'P5': 'Zastavena',
      'P6': 'STOP režim'
    };

    return statusMap[cleanStatus] || 'Neznámý stav';
  }

  private parseGarageStatus(status: string): GarageStatusType {
    const upperStatus = status.toUpperCase();

    if (upperStatus === 'P1') {
      return 'Garáž zavřena';
    }

    if (upperStatus.includes('POHYB') || upperStatus.includes('POHYBU')) {
      console.log(`MQTT: Hardware movement message received: ${status} - ignoring, timer controls state`);
      return 'Neznámý stav';
    }

    console.warn(`Unknown garage status received: ${status} - expected P1 or pohyb message`);
    return 'Neznámý stav';
  }

  private handleGateLogMessage(message: string): void {
    console.log(`🎯 HTTP MQTT Service: Log/Brana/ID message received: "${message}"`);
    console.log(`📋 Gate Log: External activity detected - ID: ${message}`);

    const logEntry: IGateLogEntry = {
      id: message.trim(),
      timestamp: new Date(),
      source: 'external'
    };

    console.log('🔔 HTTP MQTT Service: Notifying gate log callbacks with:', logEntry);
    this.notifyGateLogChange(logEntry);
  }

  public async publishGateCommand(userEmail: string): Promise<void> {
    console.log('📡 Optimized HTTP MQTT: Publishing gate command for:', userEmail);
    
    return this.makeRequest<void>('/publish', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'IoT/Brana/Ovladani',
        message: '1',
        user: `ID:${userEmail}`,
        action: 'Brána',
        timestamp: new Date().toISOString()
      })
    });
  }

  public async publishGarageCommand(userEmail: string): Promise<void> {
    console.log('📡 Optimized HTTP MQTT: Publishing garage command for:', userEmail);
    
    return this.makeRequest<void>('/publish', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'IoT/Brana/Ovladani',
        message: '3',
        user: `ID:${userEmail}`,
        action: 'Garáž',
        timestamp: new Date().toISOString()
      })
    });
  }

  public async publishAutoGateCommand(userEmail: string): Promise<void> {
    console.log('📡 Optimized HTTP MQTT: Publishing auto gate command for:', userEmail);
    
    return this.makeRequest<void>('/publish', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'IoT/Brana/Ovladani',
        message: '2',
        user: `ID:${userEmail}`,
        action: 'Auto brána',
        timestamp: new Date().toISOString()
      })
    });
  }

  public async publishStopCommand(userEmail: string): Promise<void> {
    console.log('📡 Optimized HTTP MQTT: Publishing stop command for:', userEmail);
    
    return this.makeRequest<void>('/publish', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'IoT/Brana/Ovladani',
        message: '6',
        user: `ID:${userEmail}`,
        action: 'STOP režim',
        timestamp: new Date().toISOString()
      })
    });
  }

  public async publishMessage(topic: string, message: string): Promise<void> {
    console.log('📡 Optimized HTTP MQTT: Publishing message to', topic);
    
    return this.makeRequest<void>('/publish', {
      method: 'POST',
      body: JSON.stringify({
        topic,
        message,
        timestamp: new Date().toISOString()
      })
    });
  }

  public disconnect(): void {
    console.log('🔌 Optimized HTTP MQTT Service: Disconnecting...');
    
    this.stopStatusPolling();
    this.requestCache.clear();
    
    this.currentStatus.isConnected = false;
    this.currentStatus.connectionQuality = 'disconnected';
    this.notifyStatusChange();
    
    console.log('✅ Optimized HTTP MQTT Service: Disconnect completed');
  }

  private attachVisibilityListener(): void {
    if (typeof document !== 'undefined' && !this.visibilityListenerAttached) {
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityListenerAttached = true;
    }
  }

  private detachVisibilityListener(): void {
    if (typeof document !== 'undefined' && this.visibilityListenerAttached) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityListenerAttached = false;
    }
  }

  public onStatusChange(callback: StatusCallback): UnsubscribeFunction {
    this.statusCallbacks.push(callback);
    return (): void => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  public onGateLogChange(callback: GateLogCallback): UnsubscribeFunction {
    this.gateLogCallbacks.push(callback);
    return (): void => {
      this.gateLogCallbacks = this.gateLogCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatusChange(): void {
    console.log('🔧 HTTP MQTT Service: Notifying status change to', this.statusCallbacks.length, 'callbacks');
    console.log('🔧 HTTP MQTT Service: Current status:', this.currentStatus);

    this.statusCallbacks.forEach((callback, index) => {
      try {
        console.log(`🔧 HTTP MQTT Service: Calling callback ${index}...`);
        callback({ ...this.currentStatus });
        console.log(`🔧 HTTP MQTT Service: Callback ${index} completed`);
      } catch (error) {
        console.error(`Error in status callback ${index}:`, error);
      }
    });
  }

  private notifyGateLogChange(logEntry: IGateLogEntry): void {
    console.log('🔧 HTTP MQTT Service: Notifying gate log change to', this.gateLogCallbacks.length, 'callbacks');

    this.gateLogCallbacks.forEach((callback, index) => {
      try {
        console.log(`🔧 HTTP MQTT Service: Calling gate log callback ${index}...`);
        callback(logEntry);
      } catch (error) {
        console.error(`❌ HTTP MQTT Service: Error in gate log callback ${index}:`, error);
      }
    });
  }

  public getStatus(): IMqttStatus {
    return { ...this.currentStatus };
  }

  public getConnectionStats(): IConnectionStats {
    return { ...this.connectionStats };
  }

  public getCircuitBreakerStatus(): { state: string; failureCount: number } {
    return {
      state: this.circuitBreaker.getState(),
      failureCount: this.circuitBreaker.getFailureCount()
    };
  }

  public clearCache(): void {
    this.requestCache.clear();
    console.log('🗑️ HTTP MQTT Service: Cache cleared');
  }

  public resetCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker();
    console.log('🔄 HTTP MQTT Service: Circuit breaker reset');
  }
}

export const optimizedHttpMqttService = new OptimizedHttpMqttService();
