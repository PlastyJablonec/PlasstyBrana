import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/userService';
import { UserData, UserRole, DEFAULT_PERMISSIONS } from '../types/user';
import LoadingSpinner from './LoadingSpinner';
import { db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { useAppContext } from '../contexts/AppContext';

const AdminPanelModern: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [users, setUsers] = useState<UserData[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'permissions' | 'settings'>('pending');
  
  // System settings
  const [autoCloseTimeLimit, setAutoCloseTimeLimit] = useState<number>(250);
  const [retryTimeLimit, setRetryTimeLimit] = useState<number>(3); // 4:10 default
  const [openCheckTimeLimit, setOpenCheckTimeLimit] = useState<number>(10); // 10 seconds default for open check
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  useEffect(() => {
    loadData();
    
    // Load settings from Firestore FIRST
    const loadSettings = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const settingsDoc = await getDoc(doc(db, 'settings', 'ovladaniBrany'));
        
        if (settingsDoc.exists()) {
          // Load existing settings
          const settings = settingsDoc.data();
          console.log('📥 Admin Panel loaded settings from Firestore:', settings);
          if (settings.autoCloseTimeLimit) {
            setAutoCloseTimeLimit(settings.autoCloseTimeLimit);
          }
          if (settings.retryTimeLimit) {
            setRetryTimeLimit(settings.retryTimeLimit);
          }
          if (settings.openCheckTimeLimit) {
            setOpenCheckTimeLimit(settings.openCheckTimeLimit);
          }
        } else {
          // No settings exist - try migration from old document
          console.log('🔍 No ovladaniBrany settings found, trying migration...');
          await migrateFromOldDocument();
        }
      } catch (error) {
        console.error('❌ Error loading admin settings:', error);
      }
    };
    
    // MIGRATION: Move data from old gateControl to new ovladaniBrany ONLY if no data exists
    const migrateFromOldDocument = async () => {
      try {
        const { getDoc, setDoc, doc } = await import('firebase/firestore');
        
        // Check if old document exists
        const oldDoc = await getDoc(doc(db, 'settings', 'gateControl'));
        if (oldDoc.exists()) {
          console.log('🔄 Found old gateControl document, migrating data...');
          
          // Copy data to new document
          await setDoc(doc(db, 'settings', 'ovladaniBrany'), oldDoc.data());
          console.log('✅ Data migrated from gateControl to ovladaniBrany');
          
          // Load the migrated data
          const settings = oldDoc.data();
          if (settings.autoCloseTimeLimit) {
            setAutoCloseTimeLimit(settings.autoCloseTimeLimit);
          }
          if (settings.retryTimeLimit) {
            setRetryTimeLimit(settings.retryTimeLimit);
          }
          if (settings.openCheckTimeLimit) {
            setOpenCheckTimeLimit(settings.openCheckTimeLimit);
          }
          
          // Optional: Delete old document (commented for safety)
          // await deleteDoc(doc(db, 'settings', 'gateControl'));
        } else {
          console.log('🔍 No old gateControl document found, using defaults');
        }
      } catch (error) {
        console.error('❌ Error migrating data:', error);
      }
    };
    
    loadSettings();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allUsers, pending] = await Promise.all([
        userService.getAllUsers(),
        userService.getPendingUsers()
      ]);
      setUsers(allUsers);
      setPendingUsers(pending);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Nepodařilo se načíst data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setError('');
    setSuccess('');
    
    try {
      // Save to Firestore Database for all users
      const settings = {
        autoCloseTimeLimit,
        retryTimeLimit,
        openCheckTimeLimit,
        savedAt: new Date().toISOString(),
        savedBy: user?.email || 'unknown'
      };
      
      await setDoc(doc(db, 'settings', 'ovladaniBrany'), settings);
      console.log('✅ Settings saved to Firestore:', settings);
      
      setSuccess('⚙️ Nastavení úspěšně uloženo do databáze!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('❌ Chyba při ukládání nastavení: ' + (error as Error).message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveUser = async (userId: string, role: UserRole = 'user') => {
    try {
      setActionLoading(userId);
      setError('');
      setSuccess('');
      
      await userService.approveUser(userId, 'current-admin', role);
      setSuccess(`Uživatel schválen s rolí ${role}`);
      await loadData();
    } catch (error) {
      console.error('Error approving user:', error);
      setError('Nepodařilo se schválit uživatele');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    try {
      setActionLoading(userId);
      setError('');
      setSuccess('');
      
      await userService.updateUserRole(userId, role, 'current-admin');
      setSuccess(`Role změněna na ${role}`);
      await loadData();
    } catch (error) {
      console.error('Error updating role:', error);
      setError('Nepodařilo se změnit roli');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePermissions = async (userId: string, permissions: any) => {
    try {
      setActionLoading(userId);
      setError('');
      setSuccess('');
      
      console.log('Updating permissions for user:', userId, permissions);
      await userService.updateUserPermissions(userId, permissions, 'current-admin');
      console.log('Permissions updated successfully');
      
      setSuccess('✅ Oprávnění úspěšně uložena!');
      
      // Refresh data and update selected user
      await loadData();
      const updatedUsers = await userService.getAllUsers();
      const updatedUser = updatedUsers.find(u => u.id === userId);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
      
      // Auto hide success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating permissions:', error);
      setError('❌ Nepodařilo se uložit oprávnění: ' + (error as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Opravdu chcete smazat tohoto uživatele?')) {
      return;
    }

    try {
      setActionLoading(userId);
      setError('');
      setSuccess('');
      
      await userService.deleteUser(userId, 'current-admin');
      setSuccess('Uživatel smazán');
      await loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Nepodařilo se smazat uživatele');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300';
      case 'user': return 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-300';
      case 'viewer': return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return '👑 Admin';
      case 'user': return '👤 Uživatel';
      case 'viewer': return '👁️ Divák';
      default: return role;
    }
  };

  const permissionLabels = {
    gate: { label: '🚪 Ovládání brány', icon: '🚪', description: 'Otevírání a zavírání brány' },
    garage: { label: '🏠 Ovládání garáže', icon: '🏠', description: 'Ovládání garážových vrat' },
    camera: { label: '📹 Přístup ke kameře', icon: '📹', description: 'Zobrazení kamerového záznamu' },
    stopMode: { label: '🛑 STOP režim', icon: '🛑', description: 'Nouzové zastavení' },
    viewLogs: { label: '📊 Zobrazení logů', icon: '📊', description: 'Přístup k historii akcí' },
    manageUsers: { label: '👥 Správa uživatelů', icon: '👥', description: 'Správa uživatelských účtů' },
    requireLocation: { label: '📍 Vyžadovat GPS', icon: '📍', description: 'Požadovat geolokační data' },
    allowGPS: { label: '🗺️ Povolit GPS', icon: '🗺️', description: 'Povolit GPS sledování' },
    requireLocationProximity: { label: '📏 Omezení vzdálenosti', icon: '📏', description: 'Omezit přístup podle vzdálenosti' }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="large" color="primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🛠️ Admin Panel
            </h1>
            <p className="text-gray-600 mt-2">Správa uživatelů a systémových oprávnění</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            🏠 Zpět na dashboard
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
          <div className="flex items-center">
            <span className="text-xl mr-3">❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg mb-6">
          <div className="flex items-center">
            <span className="text-xl mr-3">✅</span>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-xl mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⏳ Čekající ({pendingUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Uživatelé ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'permissions'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔐 Oprávnění
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚙️ Nastavení
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Pending Users */}
          {activeTab === 'pending' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Uživatelé čekající na schválení</h2>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">✅</span>
                  Žádní uživatelé nečekají na schválení
                </div>
              ) : (
                <div className="grid gap-4">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                        <div className="mb-4 sm:mb-0">
                          <p className="font-semibold text-gray-900 text-lg">{user.displayName}</p>
                          <p className="text-gray-600">{user.email}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            📅 Registrován: {new Date(user.createdAt).toLocaleDateString('cs-CZ')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <select
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            defaultValue="user"
                            onChange={(e) => {
                              const role = e.target.value as UserRole;
                              handleApproveUser(user.id, role);
                            }}
                            disabled={actionLoading === user.id}
                          >
                            <option value="viewer">👁️ Divák</option>
                            <option value="user">👤 Uživatel</option>
                            <option value="admin">👑 Admin</option>
                          </select>
                          <button
                            onClick={() => handleApproveUser(user.id, 'user')}
                            disabled={actionLoading === user.id}
                            className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                          >
                            {actionLoading === user.id ? (
                              <LoadingSpinner size="small" color="white" />
                            ) : (
                              '✅ Schválit'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All Users */}
          {activeTab === 'users' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Všichni uživatelé</h2>
              <div className="overflow-x-auto">
                <div className="grid gap-4">
                  {users.map((user) => (
                    <div key={user.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
                        <div className="mb-4 lg:mb-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <p className="font-semibold text-gray-900 text-lg">{user.displayName}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(user.role)}`}>
                              {getRoleLabel(user.role)}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-1">{user.email}</p>
                          <div className="text-sm text-gray-500 space-y-1">
                            <p>🔑 Status: {user.approved ? '✅ Aktivní' : '⏳ Čeká na schválení'}</p>
                            <p>🕐 Poslední přihlášení: {(() => {
                              if (!user.lastLogin) return 'Nikdy';
                              
                              try {
                                let loginDate;
                                
                                // Handle Firestore Timestamp
                                if (user.lastLogin && typeof user.lastLogin === 'object' && 'toDate' in user.lastLogin) {
                                  loginDate = (user.lastLogin as any).toDate();
                                } else {
                                  // Handle string or Date
                                  loginDate = new Date(user.lastLogin);
                                }
                                
                                if (isNaN(loginDate.getTime())) {
                                  return 'Neznámé datum';
                                }
                                
                                const formatted = loginDate.toLocaleString('cs-CZ', { 
                                  day: 'numeric', 
                                  month: 'numeric', 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                });
                                
                                return formatted;
                              } catch (error) {
                                return 'Chyba datumu';
                              }
                            })()}</p>
                            {user.lastLocation && (
                              <p>📍 GPS: {user.lastLocation.latitude.toFixed(4)}, {user.lastLocation.longitude.toFixed(4)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                          <select
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={user.role}
                            onChange={(e) => {
                              const role = e.target.value as UserRole;
                              handleUpdateRole(user.id, role);
                            }}
                            disabled={actionLoading === user.id}
                          >
                            <option value="viewer">👁️ Divák</option>
                            <option value="user">👤 Uživatel</option>
                            <option value="admin">👑 Admin</option>
                          </select>
                          <button
                            onClick={() => navigate(`/admin/permissions/${user.id}`)}
                            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                          >
                            🔐 Oprávnění
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                          >
                            {actionLoading === user.id ? (
                              <LoadingSpinner size="small" color="white" />
                            ) : (
                              '🗑️ Smazat'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Permissions */}
          {activeTab === 'permissions' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Správa oprávnění</h2>
              {selectedUser ? (
                <div className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{selectedUser.displayName}</h3>
                      <p className="text-gray-600">{selectedUser.email}</p>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      ✖️ Zavřít
                    </button>
                  </div>
                  
                  <div className="grid gap-4">
                    {Object.entries(permissionLabels).map(([key, info]) => (
                      <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{info.icon}</span>
                          <div>
                            <p className="font-medium text-gray-900">{info.label}</p>
                            <p className="text-sm text-gray-600">{info.description}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUser.permissions[key as keyof typeof selectedUser.permissions]}
                            onChange={(e) => {
                              const updatedPermissions = {
                                ...selectedUser.permissions,
                                [key]: e.target.checked
                              };
                              setSelectedUser({
                                ...selectedUser,
                                permissions: updatedPermissions
                              });
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={() => handleUpdatePermissions(selectedUser.id, selectedUser.permissions)}
                      disabled={actionLoading === selectedUser.id}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {actionLoading === selectedUser.id ? (
                        <LoadingSpinner size="small" color="white" />
                      ) : (
                        '💾 Uložit oprávnění'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">👆</span>
                  <p>Vyberte uživatele ze seznamu pro úpravu oprávnění</p>
                </div>
              )}
            </div>
          )}
          
          {/* Settings */}
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Systémová nastavení</h2>
              
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="space-y-6">
                  {/* Auto Close Time Limit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ⏰ Čas automatického zavření brány
                    </label>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="999"
                          value={Math.floor(autoCloseTimeLimit / 60)}
                          onChange={(e) => setAutoCloseTimeLimit(parseInt(e.target.value) * 60 + (autoCloseTimeLimit % 60))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-gray-600">min</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={autoCloseTimeLimit % 60}
                          onChange={(e) => setAutoCloseTimeLimit(Math.floor(autoCloseTimeLimit / 60) * 60 + parseInt(e.target.value))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-gray-600">sek</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        (Celkem: {Math.floor(autoCloseTimeLimit / 60)}:{(autoCloseTimeLimit % 60).toString().padStart(2, '0')})
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Čas po kterém se brána automaticky zavře po otevření (platí pro všechny způsoby otevření)
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">⏰ Nastavení automatického pokusu</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Čas pro automatický druhý pokus (sekundy)
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={retryTimeLimit}
                        onChange={(e) => setRetryTimeLimit(parseInt(e.target.value) || 3)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-gray-600">sekund</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Po kolika sekundách se má automaticky odeslat druhý pokus o otevření brány, pokud první pokus selže
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Nastavení kontroly otevření</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Čas pro kontrolu otevření brány (sekundy)
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        min="3"
                        max="30"
                        value={openCheckTimeLimit}
                        onChange={(e) => setOpenCheckTimeLimit(parseInt(e.target.value) || 10)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-gray-600">sekund</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Po kolika sekundách se má zkontrolovat zda se brána začala otevírat. Pokud ne, odešle se druhý pokus.
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {savingSettings ? (
                      <LoadingSpinner size="small" color="white" />
                    ) : (
                      '💾 Uložit nastavení'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanelModern;
