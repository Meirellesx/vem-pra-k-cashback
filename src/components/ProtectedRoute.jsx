import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function ProtectedRoute({ unauthenticatedElement, fallback }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return fallback || (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0A]">
        <div className="w-8 h-8 border-4 border-orange-900 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return unauthenticatedElement || null;
  }

  return <Outlet />;
}