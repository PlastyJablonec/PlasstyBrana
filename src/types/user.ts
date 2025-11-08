export type UserRole = 'admin' | 'user' | 'viewer';

export interface UserPermissions {
  gate: boolean;
  garage: boolean;
  camera: boolean;
  stopMode: boolean;
  viewLogs: boolean;
  manageUsers: boolean;
  requireLocation: boolean;
  allowGPS: boolean;
  requireLocationProximity: boolean;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

export interface UserData {
  id: string;
  email: string;
  displayName: string;
  nick?: string;
  role: UserRole;
  permissions: UserPermissions;
  lastLocation?: UserLocation;
  createdAt: Date;
  lastLogin: Date;
  approved?: boolean; // For admin approval
  approvedBy?: string; // Admin who approved
  approvedAt?: Date;
}

export interface Activity {
  id: string;
  user: string;
  userDisplayName: string;
  action: string;
  device: 'gate' | 'garage';
  status: 'success' | 'error';
  timestamp: Date;
  location?: UserLocation;
  details?: string;
}

export interface AppSettings {
  gate: {
    travelTime: number; // seconds
    autoCloseTime: number; // seconds
    stopModeEnabled: boolean;
    notificationsEnabled: boolean;
  };
  location: {
    gateLatitude: number;
    gateLongitude: number;
    maxDistanceMeters: number;
  };
  lastUser: {
    showLastUser: boolean;
    allowedRoles: string[];
    maxAgeHours: number;
  };
}

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    gate: true,
    garage: true,
    camera: true,
    stopMode: true,
    viewLogs: true,
    manageUsers: true,
    requireLocation: false,
    allowGPS: true,
    requireLocationProximity: false,
  },
  user: {
    gate: true,
    garage: true,
    camera: true,
    stopMode: false,
    viewLogs: true,
    manageUsers: false,
    requireLocation: true,
    allowGPS: true,
    requireLocationProximity: true,
  },
  viewer: {
    gate: false,
    garage: false,
    camera: true,
    stopMode: false,
    viewLogs: true,
    manageUsers: false,
    requireLocation: false,
    allowGPS: true,
    requireLocationProximity: false,
  },
};

// Helper functions
export const hasPermission = (user: UserData | null, permission: keyof UserPermissions): boolean => {
  if (!user) return false;
  // For admin panel access, check if user has admin role and is approved OR if they're the first admin
  if (permission === 'manageUsers') {
    return user.role === 'admin' && user.approved === true;
  }
  if (!user.approved) return false; // Unapproved users have no permissions for other features
  
  // Admin users have all permissions by default
  if (user.role === 'admin') {
    return true;
  }
  
  // Check if permissions exist and the specific permission is true
  return user.permissions && user.permissions[permission] === true;
};

export const canManageUsers = (user: UserData | null): boolean => {
  return hasPermission(user, 'manageUsers');
};

export const canControlGate = (user: UserData | null): boolean => {
  return hasPermission(user, 'gate');
};

export const canControlGarage = (user: UserData | null): boolean => {
  return hasPermission(user, 'garage');
};

export const canUseStopMode = (user: UserData | null): boolean => {
  return hasPermission(user, 'stopMode');
};
