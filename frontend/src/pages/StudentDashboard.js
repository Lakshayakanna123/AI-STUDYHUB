import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data } = await api.get('/analytics/student');
    setData(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/courses/join', { joinCode });
      setMessage('Joined course successfully!');
      setJoinCode('');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to join');
    }
  };

  if (!data) return <div className="p-8 text-gray-500">Loading dashboard...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">My Dashboard</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Join a course</h2>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            placeholder="Enter join code"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button className="bg-brand-500 hover:bg-brand-600 text-white px-4 rounded-md font-medium">
            Join
          </button>
        </form>
        {message && <p className="text-sm text-gray-500 mt-2">{message}</p>}
        <Link to="/courses" className="text-brand-600 text-sm font-medium block mt-3">
          Browse available courses →
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {data.courses.length ? (
          data.courses.map((c) => (
            <Link
              to={`/courses/${c.course?._id}`}
              key={c._id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-brand-300"
            >
              <h3 className="font-semibold text-gray-800">{c.course?.title}</h3>
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <p>Overall progress: {c.overallProgressPercent}%</p>
                <p>Avg quiz score: {c.avgQuizScore}%</p>
                <p>Learning score: <span className="font-medium">{c.learningScore}</span></p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                <div
                  className="bg-brand-500 h-2 rounded-full"
                  style={{ width: `${c.overallProgressPercent}%` }}
                />
              </div>
            </Link>
          ))
        ) : (
          <p className="text-gray-400 text-sm col-span-2">
            You haven't joined any courses yet. Use a join code above to get started.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Quiz History</h2>
        {data.quizHistory.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Quiz</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">%</th>
                <th className="py-2 pr-4">AI Feedback</th>
              </tr>
            </thead>
            <tbody>
              {data.quizHistory.map((q, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-4">{q.quizTitle}</td>
                  <td className="py-2 pr-4">{q.score}/{q.totalMarks}</td>
                  <td className="py-2 pr-4">{q.percentage}%</td>
                  <td className="py-2 pr-4 text-gray-500">{q.feedback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-sm">No quizzes attempted yet.</p>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
