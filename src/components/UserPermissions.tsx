import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { userService } from '../services/userService';
import { UserData } from '../types/user';
import LoadingSpinner from './LoadingSpinner';

const UserPermissions: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (userId) {
      loadUser(userId);
    }
  }, [userId]);

  const loadUser = async (id: string) => {
    try {
      setLoading(true);
      const users = await userService.getAllUsers();
      const foundUser = users.find(u => u.id === id);
      if (foundUser) {
        setUser(foundUser);
      } else {
        setError('Uživatel nenalezen');
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Nepodařilo se načíst uživatele');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permission: string, value: boolean) => {
    if (!user) return;
    
    setUser({
      ...user,
      permissions: {
        ...user.permissions,
        [permission]: value
      }
    });
  };

  const handleSavePermissions = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await userService.updateUserPermissions(user.id, user.permissions, 'current-admin');
      setSuccess('✅ Oprávnění úspěšně uložena!');
      
      // Auto hide success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving permissions:', error);
      setError('❌ Nepodařilo se uložit oprávnění: ' + (error as Error).message);
    } finally {
      setSaving(false);
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <span className="text-4xl mb-4 block">❌</span>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Uživatel nenalezen</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/admin')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              🔙 Zpět na Admin Panel
            </button>
          </div>
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
              🔐 Oprávnění uživatele
            </h1>
            <p className="text-gray-600 mt-2">
              Správa oprávnění pro: <span className="font-semibold">{user.displayName}</span> ({user.email})
            </p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            🔙 Zpět na Admin Panel
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

      {/* Permissions */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Detailní oprávnění</h2>
          <p className="text-gray-600">Přepínejte jednotlivá oprávnění podle potřeby</p>
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
                  checked={user.permissions[key as keyof typeof user.permissions]}
                  onChange={(e) => handlePermissionChange(key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
        
        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSavePermissions}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {saving ? (
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="small" color="white" />
                <span>Ukládám...</span>
              </div>
            ) : (
              '💾 Uložit oprávnění'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserPermissions;
