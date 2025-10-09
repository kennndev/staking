'use client';

import Link from 'next/link';

export default function Navigation() {
  return (
    <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-8 relative z-10">
      <h2 className="text-xl font-semibold text-white mb-4">Quick Navigation</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link 
          href="/charts"
          className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 text-center"
        >
          📊 Analytics
        </Link>
        
        <Link 
          href="/messages"
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 text-center"
        >
          💬 Messages
        </Link>
        
        <Link 
          href="/support"
          className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 text-center"
        >
          ❓ Support
        </Link>
      </div>
    </div>
  );
}
