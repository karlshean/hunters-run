import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

type Role = 'tenant' | 'manager' | 'tech';

interface RoleSwitcherProps {
  className?: string;
}

export function RoleSwitcher({ className = '' }: RoleSwitcherProps) {
  const [currentRole, setCurrentRole] = useState<Role>('tenant');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for URL parameter first
    const urlParams = new URLSearchParams(location.search);
    const roleParam = urlParams.get('as') as Role;
    
    if (roleParam && ['tenant', 'manager', 'tech'].includes(roleParam)) {
      setCurrentRole(roleParam);
      // Store in localStorage for future visits
      localStorage.setItem('demo-role', roleParam);
    } else {
      // Fall back to localStorage
      const storedRole = localStorage.getItem('demo-role') as Role;
      if (storedRole && ['tenant', 'manager', 'tech'].includes(storedRole)) {
        setCurrentRole(storedRole);
      }
    }
  }, [location.search]);

  const handleRoleChange = (newRole: Role) => {
    setCurrentRole(newRole);
    localStorage.setItem('demo-role', newRole);
    
    // Navigate to the appropriate route
    switch (newRole) {
      case 'tenant':
        navigate('/tenant');
        break;
      case 'manager':
        navigate('/manager');
        break;
      case 'tech':
        navigate('/tech');
        break;
    }
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'tenant':
        return 'Tenant';
      case 'manager':
        return 'Manager';
      case 'tech':
        return 'Technician';
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'tenant':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
          </svg>
        );
      case 'manager':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h2m-2 0v4a2 2 0 002 2h2a2 2 0 002-2v-4m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v2" />
          </svg>
        );
      case 'tech':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
    }
  };

  return (
    <div className={`inline-flex rounded-lg border border-gray-200 bg-white p-1 ${className}`}>
      {(['tenant', 'manager', 'tech'] as Role[]).map((role) => (
        <button
          key={role}
          onClick={() => handleRoleChange(role)}
          className={`
            flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all
            ${currentRole === role
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
            }
          `}
        >
          {getRoleIcon(role)}
          {getRoleLabel(role)}
        </button>
      ))}
    </div>
  );
}