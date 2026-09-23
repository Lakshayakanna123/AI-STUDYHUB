import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../api/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const StatCard = ({ label, value, subtext, color = 'blue' }) => {
  const colorMap = {
    blue: 'border-l-4 border-l-blue-500 text-blue-600 bg-blue-50/40',
    green: 'border-l-4 border-l-emerald-500 text-emerald-600 bg-emerald-50/40',
    amber: 'border-l-4 border-l-amber-500 text-amber-600 bg-amber-50/40',
    red: 'border-l-4 border-l-rose-500 text-rose-600 bg-rose-50/40',
    purple: 'border-l-4 border-l-purple-500 text-purple-600 bg-purple-50/40',
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${colorMap[color] || ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
};

const TeacherDashboard = () => {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'students' | 'gradebook' | 'courses'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const res = await api.get('/analytics/teacher');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load teacher analytics:', err);
      setError(err.response?.data?.message || 'Session expired or failed to load teacher analytics.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.title.trim()) return;
    setCreating(true);
    try {
      await api.post('/courses', newCourse);
      setNewCourse({ title: '', description: '' });
      load();
    } finally {
      setCreating(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center max-w-md shadow-sm space-y-3">
          <p className="text-rose-700 font-semibold">{error}</p>
          <a href="/login" className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm px-4 py-2 rounded-lg">
            Log In Again
          </a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium">Loading Teacher Analytics Hub...</p>
        </div>
      </div>
    );
  }

  const summary = data.summary || {
    totalStudents: data.totalStudents || 0,
    totalCourses: data.totalCourses || 0,
    totalVideos: data.totalVideos || 0,
    totalQuizzes: data.totalQuizzes || 0,
    totalQuizAttempts: (data.quizGradebook || []).length,
    averageQuizScore: data.averageScore || 0,
    averageVideoWatch: 0,
    atRiskCount: (data.students || []).filter((s) => s.performancePrediction === 'At risk').length,
    onTrackCount: (data.students || []).filter((s) => s.performancePrediction === 'On track').length,
    highPerformerCount: (data.students || []).filter((s) => s.performancePrediction === 'High Performer').length,
  };

  const studentsList = data.students || [];
  const coursesList = data.courses || [];
  const quizGradebook = data.quizGradebook || [];

  // Filter students based on search term, course, and risk status
  const filteredStudents = studentsList.filter((s) => {
    const matchesSearch =
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.studentEmail && s.studentEmail.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCourse = selectedCourse === 'all' || s.courseId === selectedCourse || s.course === selectedCourse;
    const matchesStatus = selectedStatus === 'all' || s.performancePrediction === selectedStatus;
    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Filter gradebook based on search term and course
  const filteredGradebook = quizGradebook.filter((g) => {
    const matchesSearch =
      g.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.quizTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || g.courseId === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  // Chart 1: Student Quiz Score % vs Video Watch %
  const chartStudents = filteredStudents.slice(0, 10);
  const barChartData = {
    labels: chartStudents.map((s) => s.studentName),
    datasets: [
      {
        label: 'Quiz Marks %',
        data: chartStudents.map((s) => s.quizScore),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
      },
      {
        label: 'Video Watch %',
        data: chartStudents.map((s) => s.videoWatchPercent),
        backgroundColor: '#10b981',
        borderRadius: 6,
      },
    ],
  };

  // Chart 2: Performance Distribution (High Performer vs On Track vs At Risk)
  const doughnutData = {
    labels: ['High Performers', 'On Track', 'At Risk'],
    datasets: [
      {
        data: [summary.highPerformerCount, summary.onTrackCount, summary.atRiskCount],
        backgroundColor: ['#10b981', '#3b82f6', '#f43f5e'],
        borderWidth: 0,
      },
    ],
  };

  const getPredictionBadge = (prediction) => {
    if (prediction === 'High Performer') {
      return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">🌟 High Performer</span>;
    }
    if (prediction === 'At risk') {
      return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">⚠️ At Risk</span>;
    }
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">✅ On Track</span>;
  };

  const getLearningScoreBadge = (score) => {
    if (score === 'Excellent') return <span className="font-semibold text-emerald-600">{score}</span>;
    if (score === 'Good') return <span className="font-semibold text-blue-600">{score}</span>;
    if (score === 'Needs Improvement') return <span className="font-semibold text-rose-600">{score}</span>;
    return <span className="font-medium text-gray-700">{score}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Teacher Performance Analytics & Gradebook</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor real-time student progress, quiz marks, video engagement, and AI learning predictions.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl text-sm font-medium text-gray-600 space-x-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'overview' ? 'bg-white text-brand-600 shadow-sm font-semibold' : 'hover:text-gray-900'
            }`}
          >
            📊 Analytics Hub
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'students' ? 'bg-white text-brand-600 shadow-sm font-semibold' : 'hover:text-gray-900'
            }`}
          >
            👨‍🎓 Student Progress ({studentsList.length})
          </button>
          <button
            onClick={() => setActiveTab('gradebook')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'gradebook' ? 'bg-white text-brand-600 shadow-sm font-semibold' : 'hover:text-gray-900'
            }`}
          >
            📝 Quiz Marks ({quizGradebook.length})
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'courses' ? 'bg-white text-brand-600 shadow-sm font-semibold' : 'hover:text-gray-900'
            }`}
          >
            📚 Courses ({coursesList.length})
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Students" value={summary.totalStudents} subtext="Enrolled across courses" color="blue" />
        <StatCard label="Avg Quiz Score" value={`${summary.averageQuizScore}%`} subtext="Class performance" color="green" />
        <StatCard label="Avg Video Watch" value={`${summary.averageVideoWatch}%`} subtext="Engagement level" color="purple" />
        <StatCard label="At Risk Students" value={summary.atRiskCount} subtext="Needs intervention" color="red" />
        <StatCard label="Total Quizzes" value={summary.totalQuizzes} subtext={`${summary.totalQuizAttempts} attempts`} color="amber" />
      </div>

      {/* Search & Filter Controls Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full relative">
          <input
            type="text"
            placeholder="🔍 Search student by name or email..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="all">All Courses</option>
            {coursesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Performance Status</option>
            <option value="High Performer">🌟 High Performers</option>
            <option value="On track">✅ On Track</option>
            <option value="At risk">⚠️ At Risk</option>
          </select>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">Student Quiz Marks vs Video Watch %</h2>
                <span className="text-xs text-gray-400">Top Students Comparison</span>
              </div>
              {chartStudents.length ? (
                <Bar data={barChartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No student performance data found matching filters.</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center justify-center">
              <h2 className="font-semibold text-gray-800 mb-4 w-full text-left">Student Risk Distribution</h2>
              <div className="w-48 h-48">
                <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              </div>
              <div className="mt-4 text-xs text-gray-500 text-center space-y-1">
                <p>🌟 High Performers: <strong className="text-emerald-600">{summary.highPerformerCount}</strong></p>
                <p>✅ On Track: <strong className="text-blue-600">{summary.onTrackCount}</strong></p>
                <p>⚠️ At Risk: <strong className="text-rose-600">{summary.atRiskCount}</strong></p>
              </div>
            </div>
          </div>

          {/* Quick Preview of Students at Risk */}
          {summary.atRiskCount > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
              <h3 className="font-semibold text-rose-800 text-base flex items-center gap-2">
                ⚠️ Attention Required: Students Identified as At-Risk ({summary.atRiskCount})
              </h3>
              <p className="text-xs text-rose-700 mt-1">
                These students have scored below 50% on quizzes or have video watch completion below 30%. Click any student to inspect detailed recommendations.
              </p>
              <div className="grid md:grid-cols-3 gap-3 mt-4">
                {studentsList
                  .filter((s) => s.performancePrediction === 'At risk')
                  .slice(0, 3)
                  .map((s, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-rose-200 shadow-sm">
                      <p className="font-semibold text-gray-800 text-sm">{s.studentName}</p>
                      <p className="text-xs text-gray-500">{s.course}</p>
                      <div className="flex justify-between items-center mt-2 text-xs">
                        <span className="text-rose-600 font-medium">Quiz: {s.quizScore}%</span>
                        <span className="text-gray-500">Watch: {s.videoWatchPercent}%</span>
                      </div>
                      <button
                        onClick={() => setSelectedStudent(s)}
                        className="mt-2 w-full text-center text-xs text-brand-600 font-semibold bg-brand-50 hover:bg-brand-100 py-1.5 rounded"
                      >
                        Inspect Progress & Recommendations →
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDENT PERFORMANCE TABLE */}
      {(activeTab === 'students' || activeTab === 'overview') && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Detailed Student Performance & Progress</h2>
            <span className="text-xs text-gray-500">Showing {filteredStudents.length} students</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4 text-center">Video Watch %</th>
                  <th className="py-3 px-4 text-center">Engagement (P/R)</th>
                  <th className="py-3 px-4 text-center">Quizzes</th>
                  <th className="py-3 px-4 text-center">Quiz Score %</th>
                  <th className="py-3 px-4 text-center">Overall Progress</th>
                  <th className="py-3 px-4 text-center">Learning Score</th>
                  <th className="py-3 px-4 text-center">Prediction</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length ? (
                  filteredStudents.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50/80 transition">
                      <td className="py-3.5 px-4 font-medium text-gray-800">
                        <div>{s.studentName}</div>
                        {s.studentEmail && <div className="text-xs text-gray-400">{s.studentEmail}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">{s.course}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-gray-700">{s.videoWatchPercent}%</span>
                          <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${s.videoWatchPercent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-500">
                        <span>⏸ {s.pauseCount} / 🔁 {s.replayCount}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-600 font-medium">
                        {s.quizzesAttempted} / {s.totalCourseQuizzes || 1}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-brand-600">{s.quizScore}%</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-semibold">{s.overallProgress}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">{getLearningScoreBadge(s.learningScore)}</td>
                      <td className="py-3.5 px-4 text-center">{getPredictionBadge(s.performancePrediction)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md transition"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-400">
                      No student records match your search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUIZ MARKS & GRADEBOOK */}
      {activeTab === 'gradebook' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Quiz Marks & Evaluation Gradebook</h2>
              <p className="text-xs text-gray-500">All submitted student quiz attempts with scores and AI evaluation feedback.</p>
            </div>
            <span className="text-xs font-medium text-gray-500">{filteredGradebook.length} Submissions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Quiz Title</th>
                  <th className="py-3 px-4 text-center">Marks Obtained</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                  <th className="py-3 px-4">AI Feedback Summary</th>
                  <th className="py-3 px-4 text-right">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredGradebook.length ? (
                  filteredGradebook.map((g, i) => (
                    <tr key={i} className="hover:bg-gray-50/80 transition">
                      <td className="py-3.5 px-4 font-medium text-gray-800">
                        <div>{g.studentName}</div>
                        {g.studentEmail && <div className="text-xs text-gray-400">{g.studentEmail}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">{g.courseTitle}</td>
                      <td className="py-3.5 px-4 font-medium text-gray-800">{g.quizTitle}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-800">
                        {g.totalScore} / {g.totalMarks}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            g.percentage >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : g.percentage >= 60
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {g.percentage}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600 max-w-xs truncate">
                        {g.aiFeedbackSummary || 'Evaluation complete'}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-gray-400">
                        {g.submittedAt ? new Date(g.submittedAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No quiz marks or attempts found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COURSE MANAGEMENT & CREATION */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-2">Create New Course</h2>
            <p className="text-xs text-gray-500 mb-4">
              Create a course to generate unique student join codes and enable automated video speech-to-text + AI quiz generation.
            </p>
            <form onSubmit={createCourse} className="flex flex-col md:flex-row gap-3">
              <input
                placeholder="Course Title (e.g. Intro to Data Structures)"
                required
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
              />
              <input
                placeholder="Description (optional)"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
              />
              <button
                disabled={creating}
                className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60"
              >
                {creating ? 'Creating...' : '+ Create Course'}
              </button>
            </form>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {coursesList.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-800 text-base">{c.title}</h3>
                  <span className="bg-brand-50 text-brand-700 text-xs font-mono font-bold px-2 py-1 rounded border border-brand-200">
                    CODE: {c.joinCode}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex justify-between items-center pt-2 border-t border-gray-100">
                  <span>Enrolled Students: <strong>{c.studentCount}</strong></span>
                  <Link to={`/courses/${c.id}`} className="text-brand-600 font-semibold hover:underline">
                    View Course →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STUDENT DETAILS & AI RECOMMENDATIONS MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedStudent.studentName}</h2>
                <p className="text-xs text-gray-500">{selectedStudent.studentEmail} • {selectedStudent.course}</p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            {/* Performance Overview Badges */}
            <div className="grid grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl text-center">
              <div>
                <p className="text-xs text-gray-500">Quiz Score</p>
                <p className="text-lg font-bold text-brand-600">{selectedStudent.quizScore}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Video Watch</p>
                <p className="text-lg font-bold text-emerald-600">{selectedStudent.videoWatchPercent}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Overall Progress</p>
                <p className="text-lg font-bold text-gray-800">{selectedStudent.overallProgress}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Prediction</p>
                <div className="mt-1">{getPredictionBadge(selectedStudent.performancePrediction)}</div>
              </div>
            </div>

            {/* Quiz Marks Breakdown */}
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-2">Quiz Attempts & Marks History</h3>
              {selectedStudent.quizHistory && selectedStudent.quizHistory.length ? (
                <div className="space-y-2">
                  {selectedStudent.quizHistory.map((q, idx) => (
                    <div key={idx} className="border border-gray-100 bg-white rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-gray-800">
                        <span>{q.quizTitle}</span>
                        <span className="text-brand-600">{q.totalScore}/{q.totalMarks} ({q.percentage}%)</span>
                      </div>
                      {q.aiFeedbackSummary && <p className="text-gray-500">{q.aiFeedbackSummary}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No quiz attempts recorded for this student yet.</p>
              )}
            </div>

            {/* Video Watch Engagement */}
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-2">Video Watch Breakdown</h3>
              {selectedStudent.videoBreakdown && selectedStudent.videoBreakdown.length ? (
                <div className="space-y-2">
                  {selectedStudent.videoBreakdown.map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 p-2.5 rounded-lg">
                      <span className="font-medium text-gray-700">{v.videoTitle}</span>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span>Watch: {v.completionPercent}%</span>
                        <span>Pauses: {v.pauseCount}</span>
                        <span>Replays: {v.replayCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic font-normal">Video watch progress will be tracked as student views lectures.</p>
              )}
            </div>

            {/* AI Teacher Recommendations */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-semibold text-amber-900 text-xs uppercase tracking-wider mb-1">
                🤖 AI Intervention & Teaching Recommendations
              </h4>
              {selectedStudent.performancePrediction === 'At risk' ? (
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside mt-2">
                  <li>Recommend student re-watch lecture videos for key concept clarification.</li>
                  <li>Schedule a 1-on-1 review session focusing on missed quiz questions.</li>
                  <li>Direct student to use the AI Study Tutor chatbot for step-by-step guidance.</li>
                </ul>
              ) : selectedStudent.performancePrediction === 'High Performer' ? (
                <p className="text-xs text-amber-800 mt-1">
                  Student is demonstrating exceptional mastery. Recommend providing advanced supplementary reading and challenging bonus quiz questions.
                </p>
              ) : (
                <p className="text-xs text-amber-800 mt-1">
                  Student is progressing steadily on track. Maintain current study pace and encourage consistent video watch completion.
                </p>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedStudent(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;

