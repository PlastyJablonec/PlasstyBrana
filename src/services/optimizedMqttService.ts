import mqtt, { MqttClient, IClientOptions, IConnackPacket } from 'mqtt';
import { db } from '../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { optimizedHttpMqttService } from './optimizedHttpMqttService';

export type GateStatusType = 'Brána zavřena' | 'Brána otevřena' | 'Otevírá se...' | 'Zavírá se...' | 'Zastavena' | 'STOP režim' | 'Neznámý stav';
export type GarageStatusType = 'Garáž zavřena' | 'Garáž otevřena' | 'Garáž - otevírá se...' | 'Garáž - zavírá se...' | 'Neznámý stav';

export interface IMqttStatus {
  gateStatus: GateStatusType;
  garageStatus: GarageStatusType;
  isConnected: boolean;
  rawGateStatus?: string | null;
  rawGarageStatus?: string | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  lastError?: string;
  connectionType: 'direct' | 'http-proxy' | 'none';
  latency?: number;
}

export interface IMqttConnectionOptions extends IClientOptions {
  clientId: string;
  clean: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
  keepalive: number;
  resubscribe: boolean;
  queueQoSZero: boolean;
  will: {
    topic: string;
    payload: string;
    qos: 0 | 1 | 2;
    retain: boolean;
  };
}

export interface IActivityLog {
  user: string;
  action: string;
  command: string;
  timestamp: Timestamp;
  status: 'sent' | 'failed';
}

export interface IGateLogEntry {
  id: string;
  timestamp: Date;
  source: 'app' | 'external';
}

export interface IConnectionMetrics {
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  lastConnectionTime: Date | null;
  uptime: number;
  messagesSent: number;
  messagesReceived: number;
  totalLatency: number;
  averageLatency: number;
}

type StatusCallback = (status: IMqttStatus) => void;
type GateLogCallback = (logEntry: IGateLogEntry) => void;
type MetricsCallback = (metrics: IConnectionMetrics) => void;
type UnsubscribeFunction = () => void;

class ConnectionPool {
  private connections: Map<string, MqttClient> = new Map();
  private maxConnections: number = 3;
  private connectionTimeout: number = 15000;

  async getConnection(url: string, options: IMqttConnectionOptions): Promise<MqttClient> {
    const key = `${url}-${options.clientId}`;
    
    if (this.connections.has(key)) {
      const client = this.connections.get(key)!;
      if (client.connected) {
        return client;
      } else {
        this.connections.delete(key);
        client.end(true);
      }
    }

    if (this.connections.size >= this.maxConnections) {
      const oldestKey = this.connections.keys().next().value;
      if (oldestKey) {
        const oldestClient = this.connections.get(oldestKey)!;
        oldestClient.end(true);
        this.connections.delete(oldestKey);
      }
    }

    const client = await this.createConnection(url, options);
    this.connections.set(key, client);
    return client;
  }

  private async createConnection(url: string, options: IMqttConnectionOptions): Promise<MqttClient> {
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(url, options);
      const timeout = setTimeout(() => {
        client.end(true);
        reject(new Error('Connection timeout'));
      }, this.connectionTimeout);

      client.on('connect', () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  closeAll(): void {
    this.connections.forEach(client => client.end(true));
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

class RetryManager {
  private maxRetries: number = 5;
  private baseDelay: number = 1000;
  private maxDelay: number = 30000;
  private backoffMultiplier: number = 1.5;

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 ${context}: Attempt ${attempt}/${this.maxRetries}`);
        const result = await operation();
        if (attempt > 1) {
          console.log(`✅ ${context}: Success on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`❌ ${context}: Attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < this.maxRetries) {
          const delay = Math.min(
            this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1),
            this.maxDelay
          );
          console.log(`⏳ ${context}: Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError || new Error(`${context} failed after ${this.maxRetries} attempts`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class HealthMonitor {
  private healthCheckInterval: number | null = null;
  private isHealthy: boolean = true;
  private lastHealthCheck: Date = new Date();
  private healthCheckCallbacks: ((healthy: boolean) => void)[] = [];
  private latencyHistory: number[] = [];
  private maxLatencyHistory = 10;

  start(client: MqttClient, intervalMs: number = 30000): void {
    this.stop();
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck(client);
    }, intervalMs) as any;
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private performHealthCheck(client: MqttClient): void {
    const wasHealthy = this.isHealthy;
    this.isHealthy = client.connected && !client.reconnecting;
    this.lastHealthCheck = new Date();

    if (wasHealthy !== this.isHealthy) {
      console.log(`🏥 Health status changed: ${wasHealthy} → ${this.isHealthy}`);
      this.healthCheckCallbacks.forEach(callback => callback(this.isHealthy));
    }
  }

  recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
  }

  getAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    return this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
  }

  onHealthChange(callback: (healthy: boolean) => void): UnsubscribeFunction {
    this.healthCheckCallbacks.push(callback);
    return () => {
      this.healthCheckCallbacks = this.healthCheckCallbacks.filter(cb => cb !== callback);
    };
  }

  getStatus(): { healthy: boolean; lastCheck: Date; averageLatency: number } {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
      averageLatency: this.getAverageLatency()
    };
  }
}

export class OptimizedMqttService {
  private client: MqttClient | null = null;
  private connectionPool: ConnectionPool = new ConnectionPool();
  private retryManager: RetryManager = new RetryManager();
  private healthMonitor: HealthMonitor = new HealthMonitor();
  
  private statusCallbacks: StatusCallback[] = [];
  private gateLogCallbacks: GateLogCallback[] = [];
  private metricsCallbacks: MetricsCallback[] = [];
  
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private connectionType: 'direct' | 'http-proxy' | 'none' = 'none';
  
  private currentStatus: IMqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Garáž zavřena',
    isConnected: false,
    rawGateStatus: null,
    rawGarageStatus: null,
    connectionQuality: 'disconnected',
    connectionType: 'none'
  };

  private metrics: IConnectionMetrics = {
    connectionAttempts: 0,
    successfulConnections: 0,
    failedConnections: 0,
    averageConnectionTime: 0,
    lastConnectionTime: null,
    uptime: 0,
    messagesSent: 0,
    messagesReceived: 0,
    totalLatency: 0,
    averageLatency: 0
  };

  private connectionStartTime: number = 0;
  private readonly options: IMqttConnectionOptions = {
    clientId: `gate-control-optimized-${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    keepalive: 45,
    resubscribe: true,
    queueQoSZero: false,
    will: {
      topic: 'Log/Brana/Disconnect',
      payload: JSON.stringify({
        clientId: `gate-control-optimized-${Math.random().toString(16).substring(2, 8)}`,
        timestamp: new Date().toISOString(),
        reason: 'client_disconnect'
      }),
      qos: 1,
      retain: false
    }
  };

  constructor() {
    this.healthMonitor.onHealthChange((healthy) => {
      if (!healthy && this.currentStatus.isConnected) {
        console.warn('⚠️ Health monitor detected connection issues');
        this.currentStatus.connectionQuality = 'poor';
        this.notifyStatusChange();
      } else if (healthy && this.currentStatus.isConnected) {
        this.currentStatus.connectionQuality = 'excellent';
        this.notifyStatusChange();
      }
    });
  }

  public async connect(): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      this.metrics.connectionAttempts++;
      this.connectionStartTime = Date.now();
      
      if (this.connectionState === 'connected') {
        console.log('✅ MQTT already connected, reusing existing connection');
        return;
      }

      if (this.connectionState === 'connecting') {
        console.log('⏳ MQTT connection already in progress, skipping duplicate connection');
        throw new Error('Connection already in progress');
      }

      this.connectionState = 'connecting';
      console.log('🔌 Optimized MQTT Service: Starting connection...');

      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      
      try {
        if (isHttps) {
          await this.connectViaHttpProxy();
        } else {
          await this.connectDirectWebSocket();
        }
        
        this.metrics.successfulConnections++;
        this.metrics.lastConnectionTime = new Date();
        const connectionTime = Date.now() - this.connectionStartTime;
        this.updateAverageConnectionTime(connectionTime);
        
        console.log(`✅ Connection established in ${connectionTime}ms`);
        this.notifyMetricsChange();
        
      } catch (error) {
        this.metrics.failedConnections++;
        this.connectionState = 'disconnected';
        this.currentStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
        this.notifyStatusChange();
        this.notifyMetricsChange();
        throw error;
      }
    }, 'MQTT Connection');
  }

  private async connectViaHttpProxy(): Promise<void> {
    console.log('🌐 Connecting via optimized HTTP MQTT proxy...');
    
    await optimizedHttpMqttService.connect();
    this.connectionState = 'connected';
    this.connectionType = 'http-proxy';
    this.currentStatus.isConnected = true;
    this.currentStatus.connectionType = 'http-proxy';
    this.currentStatus.connectionQuality = 'good';
    this.currentStatus.lastError = undefined;
    
    this.notifyStatusChange();
    
    optimizedHttpMqttService.onStatusChange((status: any) => {
      this.currentStatus = { 
        ...status, 
        connectionType: 'http-proxy',
        connectionQuality: status.isConnected ? 'good' : 'disconnected'
      };
      this.notifyStatusChange();
    });

    optimizedHttpMqttService.onGateLogChange((logEntry: any) => {
      this.notifyGateLogChange(logEntry);
    });
  }

  private async connectDirectWebSocket(): Promise<void> {
    const brokerUrl = this.getOptimalMqttUrl();
    console.log(`🔄 Direct WebSocket connection to ${brokerUrl}`);
    
    this.client = await this.connectionPool.getConnection(brokerUrl, this.options);
    this.setupClientEventHandlers();
    
    await this.subscribeToTopics();
    
    this.connectionState = 'connected';
    this.connectionType = 'direct';
    this.currentStatus.isConnected = true;
    this.currentStatus.connectionType = 'direct';
    this.currentStatus.connectionQuality = 'excellent';
    this.currentStatus.lastError = undefined;
    
    this.healthMonitor.start(this.client);
    this.notifyStatusChange();
  }

  private getOptimalMqttUrl(): string {
    // MQTT broker is available on port 9001 (WebSocket) and 1883 (TCP)
    const wsUrl = 'ws://89.24.76.191:9001/mqtt';
    const tcpUrl = 'mqtt://89.24.76.191:1883';
    
    // Always use WebSocket for browser compatibility
    console.log(`🔌 Using MQTT WebSocket URL: ${wsUrl}`);
    return wsUrl;
  }

  private setupClientEventHandlers(): void {
    if (!this.client) return;

    this.client.on('message', (topic: string, message: any, packet: any) => {
      this.metrics.messagesReceived++;
      const messageStr = message.toString();
      console.log(`📨 MQTT: ${topic} = ${messageStr}`);
      this.handleMessage(topic, messageStr);
    });

    this.client.on('error', (error: Error) => {
      console.error('❌ MQTT error:', error);
      this.currentStatus.lastError = error.message;
      this.currentStatus.connectionQuality = 'poor';
      this.notifyStatusChange();
    });

    this.client.on('offline', () => {
      console.log('📴 MQTT client offline');
      this.connectionState = 'disconnected';
      this.currentStatus.isConnected = false;
      this.currentStatus.connectionQuality = 'disconnected';
      this.healthMonitor.stop();
      this.notifyStatusChange();
    });

    this.client.on('reconnect', () => {
      console.log('🔄 MQTT reconnecting...');
      this.connectionState = 'reconnecting';
      this.currentStatus.connectionQuality = 'poor';
      this.notifyStatusChange();
    });
  }

  private async subscribeToTopics(): Promise<void> {
    if (!this.client) throw new Error('MQTT client not available');

    const subscriptions = [
      { topic: 'IoT/Brana/Status', qos: 0 },
      { topic: 'IoT/Brana/Status2', qos: 0 },
      { topic: 'Log/Brana/ID', qos: 1 }
    ];

    for (const { topic, qos } of subscriptions) {
      await new Promise<void>((resolve, reject) => {
        this.client!.subscribe(topic, { qos: qos as any }, (err: any) => {
          if (err) {
            reject(new Error(`Failed to subscribe to ${topic}: ${err.message}`));
          } else {
            console.log(`✅ Subscribed to ${topic}`);
            resolve();
          }
        });
      });
    }
  }

  private handleMessage(topic: string, message: string): void {
    switch (topic) {
      case 'IoT/Brana/Status':
        this.currentStatus.rawGateStatus = message;
        this.currentStatus.gateStatus = this.parseGateStatus(message);
        break;
      case 'IoT/Brana/Status2':
        this.currentStatus.rawGarageStatus = message;
        this.currentStatus.garageStatus = this.parseGarageStatus(message);
        break;
      case 'Log/Brana/ID':
        this.handleGateLogMessage(message);
        break;
    }
    this.notifyStatusChange();
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
    
    if (upperStatus === 'P1') return 'Garáž zavřena';
    if (upperStatus.includes('POHYB')) return 'Neznámý stav';
    
    return 'Neznámý stav';
  }

  private handleGateLogMessage(message: string): void {
    const logEntry: IGateLogEntry = {
      id: message.trim(),
      timestamp: new Date(),
      source: 'external'
    };
    this.notifyGateLogChange(logEntry);
  }

  public async publishGateCommand(userEmail: string): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      const startTime = Date.now();
      
      if (this.connectionType === 'http-proxy') {
        await optimizedHttpMqttService.publishGateCommand(userEmail);
      } else {
        await this.publishCommand('1', userEmail, 'Brána');
      }
      
      const latency = Date.now() - startTime;
      this.healthMonitor.recordLatency(latency);
      this.metrics.messagesSent++;
      this.metrics.totalLatency += latency;
      this.updateAverageLatency();
      this.currentStatus.latency = latency;
      
      this.notifyMetricsChange();
    }, 'Gate Command');
  }

  public async publishGarageCommand(userEmail: string): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      const startTime = Date.now();
      
      if (this.connectionType === 'http-proxy') {
        await optimizedHttpMqttService.publishGarageCommand(userEmail);
      } else {
        await this.publishCommand('3', userEmail, 'Garáž');
      }
      
      const latency = Date.now() - startTime;
      this.healthMonitor.recordLatency(latency);
      this.metrics.messagesSent++;
      this.metrics.totalLatency += latency;
      this.updateAverageLatency();
      this.currentStatus.latency = latency;
      
      this.notifyMetricsChange();
    }, 'Garage Command');
  }

  public async publishAutoGateCommand(userEmail: string): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      const startTime = Date.now();
      
      if (this.connectionType === 'http-proxy') {
        await optimizedHttpMqttService.publishAutoGateCommand(userEmail);
      } else {
        await this.publishCommand('2', userEmail, 'Auto brána');
      }
      
      const latency = Date.now() - startTime;
      this.healthMonitor.recordLatency(latency);
      this.metrics.messagesSent++;
      this.metrics.totalLatency += latency;
      this.updateAverageLatency();
      this.currentStatus.latency = latency;
      
      this.notifyMetricsChange();
      this.notifyStatusChange();
    }, 'Auto Gate Command');
  }

  public async publishStopCommand(userEmail: string): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      const startTime = Date.now();
      
      if (this.connectionType === 'http-proxy') {
        await optimizedHttpMqttService.publishStopCommand(userEmail);
      } else {
        await this.publishCommand('6', userEmail, 'STOP režim');
      }
      
      const latency = Date.now() - startTime;
      this.healthMonitor.recordLatency(latency);
      this.metrics.messagesSent++;
      this.metrics.totalLatency += latency;
      this.updateAverageLatency();
      this.currentStatus.latency = latency;
      
      this.notifyMetricsChange();
      this.notifyStatusChange();
    }, 'Stop Command');
  }

  private async publishCommand(command: string, userEmail: string, action: string): Promise<void> {
    if (!this.client || !this.currentStatus.isConnected) {
      throw new Error(`MQTT not connected - client: ${!!this.client}, connected: ${this.currentStatus.isConnected}`);
    }

    // Extract user ID from email if it contains the format we want
    let logMessage = userEmail;
    if (userEmail.includes('@')) {
      const [emailPart] = userEmail.split('@');
      // If email starts with ID format like "12345.user@", extract just the ID
      const idMatch = emailPart.match(/^(\d+)\./);
      if (idMatch) {
        logMessage = `ID: ${idMatch[1]} ${userEmail}`;
      }
    }

    return new Promise<void>((resolve, reject) => {
      this.client!.publish('IoT/Brana/Ovladani', command, { qos: 0 }, (error: any) => {
        if (error) {
          reject(error);
        } else {
          console.log(`✅ Command sent: ${command} by ${logMessage} to Log/Brana/`);
          resolve();
        }
      });
    });
  }

  public disconnect(): void {
    console.log('🔌 Disconnecting optimized MQTT service...');
    
    this.healthMonitor.stop();
    this.connectionPool.closeAll();
    
    if (this.connectionType === 'http-proxy') {
      optimizedHttpMqttService.disconnect();
    }
    
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true);
      this.client = null;
    }
    
    this.connectionState = 'disconnected';
    this.connectionType = 'none';
    this.currentStatus.isConnected = false;
    this.currentStatus.connectionQuality = 'disconnected';
    this.currentStatus.connectionType = 'none';
    this.currentStatus.latency = undefined;
    
    this.notifyStatusChange();
  }

  private updateAverageConnectionTime(connectionTime: number): void {
    const totalConnections = this.metrics.successfulConnections;
    if (totalConnections === 1) {
      this.metrics.averageConnectionTime = connectionTime;
    } else {
      this.metrics.averageConnectionTime = 
        (this.metrics.averageConnectionTime * (totalConnections - 1) + connectionTime) / totalConnections;
    }
  }

  private updateAverageLatency(): void {
    if (this.metrics.messagesSent === 0) {
      this.metrics.averageLatency = 0;
    } else {
      this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.messagesSent;
    }
  }

  public onStatusChange(callback: StatusCallback): UnsubscribeFunction {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  public onGateLogChange(callback: GateLogCallback): UnsubscribeFunction {
    this.gateLogCallbacks.push(callback);
    return () => {
      this.gateLogCallbacks = this.gateLogCallbacks.filter(cb => cb !== callback);
    };
  }

  public onMetricsChange(callback: MetricsCallback): UnsubscribeFunction {
    this.metricsCallbacks.push(callback);
    return () => {
      this.metricsCallbacks = this.metricsCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatusChange(): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback({ ...this.currentStatus });
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }

  private notifyGateLogChange(logEntry: IGateLogEntry): void {
    this.gateLogCallbacks.forEach(callback => {
      try {
        callback(logEntry);
      } catch (error) {
        console.error('Error in gate log callback:', error);
      }
    });
  }

  private notifyMetricsChange(): void {
    this.metricsCallbacks.forEach(callback => {
      try {
        callback({ ...this.metrics });
      } catch (error) {
        console.error('Error in metrics callback:', error);
      }
    });
  }

  public getStatus(): IMqttStatus {
    return { ...this.currentStatus };
  }

  public getMetrics(): IConnectionMetrics {
    return { ...this.metrics };
  }

  public isConnected(): boolean {
    return this.currentStatus.isConnected;
  }

  public getConnectionType(): string {
    return this.connectionType;
  }

  public getConnectionPoolSize(): number {
    return this.connectionPool.getConnectionCount();
  }

  public testConnection(): Promise<{ latency: number; success: boolean }> {
    return new Promise((resolve) => {
      if (!this.client || !this.currentStatus.isConnected) {
        resolve({ latency: -1, success: false });
        return;
      }

      const startTime = Date.now();
      const testTopic = `Test/${this.options.clientId}`;
      const testMessage = JSON.stringify({ timestamp: startTime });

      const timeout = setTimeout(() => {
        resolve({ latency: -1, success: false });
      }, 5000);

      const messageHandler = (topic: string, message: any) => {
        if (topic === testTopic) {
          clearTimeout(timeout);
          const latency = Date.now() - startTime;
          this.healthMonitor.recordLatency(latency);
          resolve({ latency, success: true });
        }
      };

      this.client!.on('message', messageHandler);
      this.client!.subscribe(testTopic, { qos: 0 });
      this.client!.publish(testTopic, testMessage, { qos: 0 });

      setTimeout(() => {
        this.client!.removeListener('message', messageHandler);
        this.client!.unsubscribe(testTopic);
      }, 6000);
    });
  }
}

export const optimizedMqttService = new OptimizedMqttService();
