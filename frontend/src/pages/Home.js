import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
  return (
    <div className="max-w-3xl mx-auto text-center mt-24 px-6">
      <h1 className="text-4xl font-bold text-gray-800">AI-Powered Virtual Classroom</h1>
      <p className="text-gray-500 mt-4">
        Upload lectures, auto-generate quizzes, get AI-graded feedback, and chat with an AI tutor
        trained only on your course material.
      </p>
      {!user ? (
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/login" className="bg-white border border-gray-300 px-5 py-2 rounded-md font-medium">
            Log in
          </Link>
          <Link to="/register" className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-md font-medium">
            Get started
          </Link>
        </div>
      ) : (
        <Link
          to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'}
          className="inline-block mt-8 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-md font-medium"
        >
          Go to dashboard
        </Link>
      )}
    </div>
  );
};

export default Home;
