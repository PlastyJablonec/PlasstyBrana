import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { hasPermission } from '../types/user';

interface DashboardHeaderProps {
  onLogout: () => void;
  onNavigateToAdmin: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onLogout,
  onNavigateToAdmin
}) => {
  const { user } = useAppContext();

  const formatLastLogin = (lastLogin: any) => {
    if (!lastLogin) return 'Nikdy';
    
    try {
      let loginDate;
      
      // Handle Firestore Timestamp
      if (lastLogin && typeof lastLogin === 'object' && 'toDate' in lastLogin) {
        loginDate = (lastLogin as any).toDate();
      } else {
        // Handle string or Date
        loginDate = new Date(lastLogin);
      }
      
      if (isNaN(loginDate.getTime())) {
        return 'Neznámé datum';
      }
      
      return loginDate.toLocaleString('cs-CZ', { 
        day: 'numeric', 
        month: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return 'Chyba datumu';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">🚪</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Ovládání Brány</h1>
                <p className="text-sm text-gray-600">
                  Vítejte, <span className="font-medium">{user?.displayName || user?.email}</span>
                  <span className="ml-2 px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-full text-xs font-medium">
                    {user?.role}
                  </span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-500">Poslední přihlášení</p>
              <p className="text-sm text-gray-700">
                {formatLastLogin(user?.lastLogin)}
              </p>
            </div>
            
            {hasPermission(user, 'manageUsers') && (
              <button
                onClick={onNavigateToAdmin}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Odhlásit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
