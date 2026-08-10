import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-lg font-bold text-brand-600">
        Virtual Classroom
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <Link
              to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'}
              className="text-gray-700 hover:text-brand-600"
            >
              Dashboard
            </Link>
            <span className="text-gray-500">
              {user.name} <span className="text-xs uppercase text-brand-600">({user.role})</span>
            </span>
            <button
              onClick={handleLogout}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-700 hover:text-brand-600">Login</Link>
            <Link to="/register" className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-md">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
