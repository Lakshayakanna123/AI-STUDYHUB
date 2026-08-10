import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import api from '../api/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const StatCard = ({ label, value }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
  </div>
);

const TeacherDashboard = () => {
  const [data, setData] = useState(null);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });

  const load = async () => {
    const { data } = await api.get('/analytics/teacher');
    setData(data);
  };

  useEffect(() => {
    load();
  }, []);

  const createCourse = async (e) => {
    e.preventDefault();
    await api.post('/courses', newCourse);
    setNewCourse({ title: '', description: '' });
    load();
  };

  if (!data) return <div className="p-8 text-gray-500">Loading dashboard...</div>;

  const chartData = {
    labels: data.students.map((s) => s.studentName),
    datasets: [
      { label: 'Quiz Score %', data: data.students.map((s) => s.quizScore), backgroundColor: '#3b6fed' },
      { label: 'Video Watch %', data: data.students.map((s) => s.videoWatchPercent), backgroundColor: '#93c5fd' },
    ],
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Teacher Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Students" value={data.totalStudents} />
        <StatCard label="Total Courses" value={data.totalCourses} />
        <StatCard label="Total Videos" value={data.totalVideos} />
        <StatCard label="Total Quizzes" value={data.totalQuizzes} />
        <StatCard label="Avg. Score" value={`${data.averageScore}%`} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Student Performance</h2>
        {data.students.length ? <Bar data={chartData} /> : <p className="text-gray-400 text-sm">No student data yet.</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Create a new course</h2>
        <form onSubmit={createCourse} className="flex gap-2">
          <input
            placeholder="Course title"
            required
            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
            value={newCourse.title}
            onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
          />
          <input
            placeholder="Description"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
            value={newCourse.description}
            onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
          />
          <button className="bg-brand-500 hover:bg-brand-600 text-white px-4 rounded-md font-medium">
            Create
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 overflow-x-auto">
        <h2 className="font-semibold text-gray-700 mb-4">Student Analytics</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">Student</th>
              <th className="py-2 pr-4">Course</th>
              <th className="py-2 pr-4">Watch %</th>
              <th className="py-2 pr-4">Pauses</th>
              <th className="py-2 pr-4">Replays</th>
              <th className="py-2 pr-4">Quiz Score</th>
              <th className="py-2 pr-4">Learning Score</th>
              <th className="py-2 pr-4">Prediction</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 pr-4">{s.studentName}</td>
                <td className="py-2 pr-4">{s.course}</td>
                <td className="py-2 pr-4">{s.videoWatchPercent}%</td>
                <td className="py-2 pr-4">{s.pauseCount}</td>
                <td className="py-2 pr-4">{s.replayCount}</td>
                <td className="py-2 pr-4">{s.quizScore}%</td>
                <td className="py-2 pr-4">{s.learningScore}</td>
                <td className="py-2 pr-4">{s.performancePrediction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link to="/courses" className="text-brand-600 font-medium text-sm">
        Manage my courses →
      </Link>
    </div>
  );
};

export default TeacherDashboard;
