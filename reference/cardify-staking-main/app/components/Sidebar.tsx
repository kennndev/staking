'use client';

import { useEffect } from 'react';
import { useStaking } from '../contexts/StakingContext';

const menuItems = [
  { icon: '🏠', label: 'DASHBOARD', active: true },
  { icon: '📊', label: 'TOKEN ANALYTICS', active: false },
  { icon: '💰', label: 'STAKING', active: false },
  { icon: '🎮', label: 'GAMES', active: false },
  { icon: '👑', label: 'ADMIN', active: false },
  { icon: '💬', label: 'MESSAGES', active: false },
  { icon: '❓', label: 'SUPPORT', active: false },
];

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ activeSection, setActiveSection, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const { isAdmin, walletAddress } = useStaking();
  
  // Debug logging
  console.log('Sidebar - isAdmin:', isAdmin);
  console.log('Sidebar - walletAddress:', walletAddress);

  // Handle mobile menu item click
  const handleMenuClick = (label: string) => {
    setActiveSection(label);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onMobileClose) {
        onMobileClose();
      }
    };

    if (isMobileOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileOpen, onMobileClose]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      
      {/* Desktop Sidebar */}
      <div className="w-64 sidebar-gradient min-h-screen p-4 hidden md:block">
        <div className="space-y-2">
          {menuItems.map((item, index) => {
            // Hide admin menu if user is not admin
            if (item.label === 'ADMIN' && !isAdmin) {
              return null;
            }
            
            return (
              <div key={index} className="relative">
                <button
                  onClick={() => setActiveSection(item.label)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 touch-target ${
                    activeSection === item.label
                      ? 'bg-white/10 text-white'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className={`fixed top-0 left-0 bottom-0 w-80 sidebar-gradient z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4 h-full overflow-y-auto">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Menu</h2>
            <button
              onClick={onMobileClose}
              className="p-2 text-gray-400 hover:text-white touch-target"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile Menu Items */}
          <div className="space-y-2">
            {menuItems.map((item, index) => {
              // Hide admin menu if user is not admin
              if (item.label === 'ADMIN' && !isAdmin) {
                return null;
              }
              
              return (
                <div key={index} className="relative">
                  <button
                    onClick={() => handleMenuClick(item.label)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-all duration-200 touch-target ${
                      activeSection === item.label
                        ? 'bg-white/10 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-base font-medium">{item.label}</span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
