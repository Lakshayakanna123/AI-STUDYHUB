import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const QuizPage = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [canGenerate, setCanGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadQuiz = () => {
    setError('');
    api
      .get(`/quizzes/video/${videoId}`)
      .then(({ data }) => {
        setQuiz(data);
        setCanGenerate(false);
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Quiz unavailable';
        const canGen = err.response?.data?.canGenerate || err.response?.status === 404;
        setError(msg);
        setCanGenerate(canGen);
      });
  };

  useEffect(() => {
    loadQuiz();
  }, [videoId]);

  const generateQuiz = async () => {
    setGenerating(true);
    setError('');
    try {
      const { data } = await api.post(`/quizzes/generate/${videoId}`);
      if (data.quiz) {
        setQuiz(data.quiz);
        setCanGenerate(false);
      } else {
        // Quiz was saved server-side, reload it
        loadQuiz();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Quiz generation failed. Please try again.');
      setCanGenerate(true);
    } finally {
      setGenerating(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([questionId, studentAnswer]) => ({
        questionId,
        studentAnswer,
      }));
      const { data } = await api.post(`/quizzes/${quiz._id}/submit`, { answers: payload });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- GENERATING STATE ---
  if (generating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-bold text-gray-800">Generating Quiz with AI...</h2>
          <p className="text-sm text-gray-500">
            Our AI is analyzing the lecture transcript and creating quiz questions with different types
            (MCQ, True/False, Short Answer, Long Answer). This may take 15-30 seconds.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="inline-block w-2 h-2 bg-brand-500 rounded-full animate-pulse"></span>
            Analyzing transcript & generating questions...
          </div>
        </div>
      </div>
    );
  }

  // --- ERROR STATE with Generate Button ---
  if (error && !quiz) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-md shadow-sm space-y-4">
          <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center text-3xl">
            📝
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            {canGenerate ? 'Quiz Not Generated Yet' : 'Quiz Unavailable'}
          </h2>
          <p className="text-sm text-gray-500">
            {canGenerate
              ? 'No quiz has been created for this video yet. Click below to have AI automatically generate a quiz based on the lecture content.'
              : error}
          </p>
          {canGenerate && (
            <button
              onClick={generateQuiz}
              className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl transition shadow-sm text-sm"
            >
              🤖 Generate Quiz with AI
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="block mx-auto text-brand-600 font-medium text-sm hover:underline"
          >
            ← Back to course
          </button>
        </div>
      </div>
    );
  }

  // --- LOADING STATE ---
  if (!quiz) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // --- RESULT STATE ---
  if (result) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Quiz Results</h1>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-lg font-semibold">
            Score: {result.totalScore} / {result.totalMarks} ({result.percentage}%)
          </p>
          <div className="w-full bg-gray-100 rounded-full h-3 mt-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                result.percentage >= 80 ? 'bg-emerald-500' : result.percentage >= 50 ? 'bg-blue-500' : 'bg-rose-500'
              }`}
              style={{ width: `${result.percentage}%` }}
            />
          </div>
          <p className="text-gray-600 mt-3 text-sm">{result.aiFeedbackSummary}</p>
        </div>
        {result.answers.map((a, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 shadow-sm text-sm">
            <p className="font-medium">Marks: {a.marksAwarded}/{a.maxMarks} ({a.correctnessPercent}%)</p>
            {a.strengths?.length > 0 && <p className="text-green-600 mt-1">Strengths: {a.strengths.join(', ')}</p>}
            {a.missingConcepts?.length > 0 && (
              <p className="text-amber-600 mt-1">Missing: {a.missingConcepts.join(', ')}</p>
            )}
            {a.suggestions?.length > 0 && (
              <p className="text-gray-500 mt-1">Suggestions: {a.suggestions.join(', ')}</p>
            )}
          </div>
        ))}
        <button onClick={() => navigate(-1)} className="text-brand-600 font-medium text-sm">
          ← Back to course
        </button>
      </div>
    );
  }

  // --- QUIZ FORM ---
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{quiz.title}</h1>
        <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-3 py-1 rounded-full">
          {quiz.questions.length} Questions
        </span>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {quiz.questions.map((q, idx) => (
          <div key={q._id} className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="font-medium text-gray-800 mb-2">
              <span className="text-brand-600 font-bold mr-1">Q{idx + 1}.</span>
              {q.questionText} <span className="text-xs text-gray-400">({q.marks} marks)</span>
            </p>
            {q.type === 'mcq' ? (
              <div className="space-y-1">
                {q.options?.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg">
                    <input
                      type="radio"
                      name={q._id}
                      value={opt}
                      onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                      className="accent-brand-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : q.type === 'true_false' ? (
              <div className="flex gap-4">
                {['True', 'False'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg">
                    <input
                      type="radio"
                      name={q._id}
                      value={opt}
                      onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                      className="accent-brand-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                rows={q.type === 'long_answer' ? 5 : 2}
                placeholder={`Type your ${q.type === 'long_answer' ? 'detailed ' : ''}answer here...`}
                onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
              />
            )}
          </div>
        ))}
        <button
          disabled={submitting}
          className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold transition disabled:opacity-60 shadow-sm"
        >
          {submitting ? 'Submitting & Evaluating...' : 'Submit Quiz'}
        </button>
      </form>
    </div>
  );
};

export default QuizPage;

