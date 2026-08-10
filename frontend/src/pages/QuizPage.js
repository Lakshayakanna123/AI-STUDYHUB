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

  useEffect(() => {
    api
      .get(`/quizzes/video/${videoId}`)
      .then(({ data }) => setQuiz(data))
      .catch((err) => setError(err.response?.data?.message || 'Quiz unavailable'));
  }, [videoId]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = Object.entries(answers).map(([questionId, studentAnswer]) => ({
      questionId,
      studentAnswer,
    }));
    const { data } = await api.post(`/quizzes/${quiz._id}/submit`, { answers: payload });
    setResult(data);
  };

  if (error) return <div className="p-8 text-red-500 max-w-2xl mx-auto">{error}</div>;
  if (!quiz) return <div className="p-8 text-gray-500">Loading quiz...</div>;

  if (result) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Quiz Results</h1>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-lg font-semibold">
            Score: {result.totalScore} / {result.totalMarks} ({result.percentage}%)
          </p>
          <p className="text-gray-600 mt-2">{result.aiFeedbackSummary}</p>
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">{quiz.title}</h1>
      <form onSubmit={submit} className="space-y-4">
        {quiz.questions.map((q) => (
          <div key={q._id} className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="font-medium text-gray-800 mb-2">
              {q.questionText} <span className="text-xs text-gray-400">({q.marks} marks)</span>
            </p>
            {q.type === 'mcq' ? (
              <div className="space-y-1">
                {q.options?.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q._id}
                      value={opt}
                      onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : q.type === 'true_false' ? (
              <div className="flex gap-4">
                {['True', 'False'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q._id}
                      value={opt}
                      onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={q.type === 'long_answer' ? 5 : 2}
                onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
              />
            )}
          </div>
        ))}
        <button className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-md font-medium">
          Submit Quiz
        </button>
      </form>
    </div>
  );
};

export default QuizPage;
