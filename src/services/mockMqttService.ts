// Mock MQTT Service pro testování

export interface IMqttStatus {
  gateStatus: string;
  garageStatus: string;
  isConnected: boolean;
  rawGateStatus: any;
  rawGarageStatus: any;
  connectionQuality: string;
  connectionType: string;
  lastError?: string;
  latency?: number;
}

export interface IConnectionMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  messagesReceived: number;
  messagesSent: number;
  averageLatency: number;
  totalLatency: number;
  uptime: number;
  lastConnectionTime: Date | null;
  connectionAttempts: number;
  averageConnectionTime: number;
}

export interface IActivityLog {
  timestamp: Date;
  type: string;
  message: string;
  details?: any;
}

export interface IGateLogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error';
}

export type GateStatusType = 'Brána zavřena' | 'Brána otevřena' | 'Otevírá se...' | 'Zavírá se...' | 'Zastavena' | 'STOP režim' | 'Neznámý stav';
export type GarageStatusType = 'Garáž zavřena' | 'Garáž otevřena' | 'Garáž - otevírá se...' | 'Garáž - zavírá se...' | 'Neznámý stav';

export interface IMqttConnectionOptions {
  clientId: string;
  clean: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
  keepalive: number;
  resubscribe: boolean;
  queueQoSZero: boolean;
  will?: {
    topic: string;
    payload: string;
    qos: number;
    retain: boolean;
  };
}

class MockMqttService {
  private currentStatus: IMqttStatus = {
    gateStatus: 'Brána zavřena',
    garageStatus: 'Garáž zavřena',
    isConnected: false,
    rawGateStatus: null,
    rawGarageStatus: null,
    connectionQuality: 'disconnected',
    connectionType: 'none',
    lastError: undefined,
    latency: undefined
  };

  private metrics: IConnectionMetrics = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    averageLatency: 0,
    totalLatency: 0,
    uptime: 0,
    lastConnectionTime: null,
    connectionAttempts: 0,
    averageConnectionTime: 0
  };

  private onStatusChangeListeners: ((status: IMqttStatus) => void)[] = [];
  private onMetricsChangeListeners: ((metrics: IConnectionMetrics) => void)[] = [];
  private onActivityLogListeners: ((logEntry: IActivityLog) => void)[] = [];
  private onGateLogChangeListeners: ((logEntry: IGateLogEntry) => void)[] = [];

  async connect(): Promise<void> {
    console.log('🔌 Mock MQTT: Connecting...');
    
    // Simulace připojení
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    this.currentStatus.isConnected = true;
    this.currentStatus.connectionType = 'direct';
    this.currentStatus.connectionQuality = 'excellent';
    this.currentStatus.lastError = undefined;
    this.currentStatus.gateStatus = 'Brána zavřena';
    this.currentStatus.garageStatus = 'Garáž zavřena';
    
    this.metrics = {
      ...this.metrics,
      totalConnections: this.metrics.totalConnections + 1,
      successfulConnections: this.metrics.successfulConnections + 1,
      lastConnectionTime: new Date(),
      uptime: Date.now()
    };
    
    console.log('✅ Mock MQTT: Connected successfully');
    this.notifyStatusChange();
    this.notifyMetricsChange();
    
    // Simulace změn stavu
    this.startStatusSimulation();
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Mock MQTT: Disconnecting...');
    
    this.currentStatus.isConnected = false;
    this.currentStatus.connectionQuality = 'disconnected';
    this.currentStatus.connectionType = 'none';
    
    console.log('✅ Mock MQTT: Disconnected');
    this.notifyStatusChange();
  }

  async publishGateCommand(userEmail: string): Promise<void> {
    console.log(`📤 Mock MQTT: Gate command by ${userEmail}`);
    
    this.currentStatus.gateStatus = 'Otevírá se...';
    this.notifyStatusChange();
    
    // Simulace otevírání brány
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.currentStatus.gateStatus = 'Brána otevřena';
    this.metrics = { ...this.metrics, messagesSent: this.metrics.messagesSent + 1 };
    this.notifyStatusChange();
    this.notifyMetricsChange();
    
    // Automatické zavření po 5 sekundách
    setTimeout(() => {
      this.currentStatus.gateStatus = 'Zavírá se...';
      this.notifyStatusChange();
      
      setTimeout(() => {
        this.currentStatus.gateStatus = 'Brána zavřena';
        this.notifyStatusChange();
      }, 2000);
    }, 5000);
  }

  async publishGarageCommand(userEmail: string): Promise<void> {
    console.log(`📤 Mock MQTT: Garage command by ${userEmail}`);
    
    this.currentStatus.garageStatus = 'Garáž - otevírá se...';
    this.notifyStatusChange();
    
    // Simulace otevírání garáže
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    this.currentStatus.garageStatus = 'Garáž otevřena';
    this.metrics = { ...this.metrics, messagesSent: this.metrics.messagesSent + 1 };
    this.notifyStatusChange();
    this.notifyMetricsChange();
  }

  async publishStopCommand(userEmail: string): Promise<void> {
    console.log(`📤 Mock MQTT: Stop command by ${userEmail}`);
    
    this.currentStatus.gateStatus = 'STOP režim';
    this.currentStatus.garageStatus = 'Neznámý stav';
    this.metrics = { ...this.metrics, messagesSent: this.metrics.messagesSent + 1 };
    this.notifyStatusChange();
    this.notifyMetricsChange();
    
    // Vrácení do normálního stavu po 3 sekundách
    setTimeout(() => {
      this.currentStatus.gateStatus = 'Brána zavřena';
      this.currentStatus.garageStatus = 'Garáž zavřena';
      this.notifyStatusChange();
    }, 3000);
  }

  private startStatusSimulation(): void {
    // Simulace náhodných změn stavu pro testování
    setInterval(() => {
      if (this.currentStatus.isConnected) {
        const random = Math.random();
        if (random < 0.1) { // 10% šance na změnu stavu
          const gateStates: GateStatusType[] = ['Brána zavřena', 'Brána otevřena'];
          const garageStates: GarageStatusType[] = ['Garáž zavřena', 'Garáž otevřena'];
          
          this.currentStatus.gateStatus = gateStates[Math.floor(Math.random() * gateStates.length)];
          this.currentStatus.garageStatus = garageStates[Math.floor(Math.random() * garageStates.length)];
          this.notifyStatusChange();
        }
      }
    }, 10000);
  }

  getStatus(): IMqttStatus {
    return { ...this.currentStatus };
  }

  getMetrics(): IConnectionMetrics {
    return { ...this.metrics };
  }

  onStatusChange(callback: (status: IMqttStatus) => void): () => void {
    this.onStatusChangeListeners.push(callback);
    return () => {
      const index = this.onStatusChangeListeners.indexOf(callback);
      if (index > -1) {
        this.onStatusChangeListeners.splice(index, 1);
      }
    };
  }

  onMetricsChange(callback: (metrics: IConnectionMetrics) => void): () => void {
    this.onMetricsChangeListeners.push(callback);
    return () => {
      const index = this.onMetricsChangeListeners.indexOf(callback);
      if (index > -1) {
        this.onMetricsChangeListeners.splice(index, 1);
      }
    };
  }

  onActivityLogChange(callback: (logEntry: IActivityLog) => void): () => void {
    this.onActivityLogListeners.push(callback);
    return () => {
      const index = this.onActivityLogListeners.indexOf(callback);
      if (index > -1) {
        this.onActivityLogListeners.splice(index, 1);
      }
    };
  }

  onGateLogChange(callback: (logEntry: IGateLogEntry) => void): () => void {
    this.onGateLogChangeListeners.push(callback);
    return () => {
      const index = this.onGateLogChangeListeners.indexOf(callback);
      if (index > -1) {
        this.onGateLogChangeListeners.splice(index, 1);
      }
    };
  }

  private notifyStatusChange(): void {
    this.onStatusChangeListeners.forEach(callback => {
      try {
        callback(this.getStatus());
      } catch (error) {
        console.error('Error in status change callback:', error);
      }
    });
  }

  private notifyMetricsChange(): void {
    this.onMetricsChangeListeners.forEach(callback => {
      try {
        callback(this.getMetrics());
      } catch (error) {
        console.error('Error in metrics change callback:', error);
      }
    });
  }
}

export const mockMqttService = new MockMqttService();
