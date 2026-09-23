import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import VideoPlayer from '../components/VideoPlayer';
import ChatbotWidget from '../components/ChatbotWidget';

const CourseDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [uploadForm, setUploadForm] = useState({ title: '', file: null });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: v }] = await Promise.all([
      api.get(`/courses/${id}`),
      api.get(`/videos/course/${id}`),
    ]);
    setCourse(c);
    setVideos(v);
    if (!activeVideo && v.length) setActiveVideo(v[0]);
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('title', uploadForm.title);
    formData.append('video', uploadForm.file);
    try {
      await api.post(`/videos/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadForm({ title: '', file: null });
      load();
    } finally {
      setUploading(false);
    }
  };

  if (!course) return <div className="p-8 text-gray-500">Loading course...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">{course.title}</h1>
      <p className="text-gray-500 mt-1">{course.description}</p>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-4">
          {activeVideo ? (
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">{activeVideo.title}</h2>
              {user.role === 'student' ? (
                <>
                  <VideoPlayer video={activeVideo} courseId={id} />
                  <Link
                    to={`/quiz/${activeVideo._id}`}
                    className="inline-block mt-3 text-sm text-brand-600 font-medium"
                  >
                    Take quiz for this video →
                  </Link>
                </>
              ) : (
                <video
                  src={`${process.env.REACT_APP_FILE_URL || 'http://localhost:5000'}${activeVideo.url}`}
                  controls
                  className="w-full rounded-lg bg-black"
                />
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No videos uploaded yet.</p>
          )}

          {user.role === 'teacher' && (
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-3">Upload a lecture video</h2>
              <form onSubmit={handleUpload} className="space-y-2">
                <input
                  placeholder="Video title"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                />
                <input
                  type="file"
                  accept="video/*"
                  required
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  className="text-sm"
                />
                <button
                  disabled={uploading}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <p className="text-xs text-gray-400">
                  After upload, the AI service transcribes the video and drafts quiz questions automatically.
                </p>
              </form>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-3">Lectures</h2>
            <ul className="space-y-1">
              {videos.map((v) => (
                <li key={v._id}>
                  <button
                    onClick={() => setActiveVideo(v)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                      activeVideo?._id === v._id ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{v.title}</span>
                      {v.questionsGenerated ? (
                        <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">Quiz ✅</span>
                      ) : v.transcriptStatus === 'processing' ? (
                        <span className="text-xs text-amber-500 font-medium whitespace-nowrap">AI ⏳</span>
                      ) : null}
                    </div>
                    {v.transcriptStatus !== 'done' && (
                      <span className="text-xs text-gray-400 block">AI processing: {v.transcriptStatus}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <ChatbotWidget courseId={id} />
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
