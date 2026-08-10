import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const ChatbotWidget = ({ courseId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get(`/chatbot/${courseId}/history`).then(({ data }) => setMessages(data));
  }, [courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const question = input;
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post(`/chatbot/${courseId}`, { message: question });
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-96">
      <div className="px-4 py-3 border-b font-semibold text-gray-700 text-sm">AI Tutor</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm">
            Ask about anything covered in this course's lectures — explanations, examples, summaries, or practice questions.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-brand-500 text-white ml-auto' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className="text-xs text-gray-400">AI Tutor is thinking...</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Ask the AI tutor..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="bg-brand-500 hover:bg-brand-600 text-white px-3 rounded-md text-sm font-medium">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatbotWidget;
