import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const CourseList = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get('/courses').then((res) => setCourses(res.data));
  }, []);

  const enroll = async (id) => {
    try {
      await api.post(`/courses/${id}/enroll`);
      const res = await api.get('/courses');
      setCourses(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not enroll in this course');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">
        {user.role === 'teacher' ? 'My Courses' : 'Available Courses'}
      </h1>
      <div className="grid md:grid-cols-2 gap-4">
        {courses.map((c) => (
          <div key={c._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800">{c.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{c.description}</p>
            {user.role === 'teacher' ? (
              <>
                <p className="text-xs text-gray-400 mt-2">Join code: {c.joinCode}</p>
                <Link to={`/courses/${c._id}`} className="text-brand-600 text-sm font-medium block mt-3">
                  Manage course →
                </Link>
              </>
            ) : (
              <div className="flex gap-2 mt-3">
                <Link to={`/courses/${c._id}`} className="text-brand-600 text-sm font-medium">
                  View
                </Link>
                <button onClick={() => enroll(c._id)} className="text-sm text-gray-500 hover:text-brand-600">
                  Enroll
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseList;