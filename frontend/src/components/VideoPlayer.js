import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const VideoPlayer = ({ video, courseId, onUnlocked }) => {
  const videoRef = useRef(null);
  const [progress, setProgress] = useState({ completionPercent: 0, quizUnlocked: false });
  const lastReportedTime = useRef(0);

  useEffect(() => {
    api.get(`/progress/video/${video._id}`).then(({ data }) => {
      setProgress(data);
      if (videoRef.current && data.lastPositionSeconds) {
        videoRef.current.currentTime = data.lastPositionSeconds;
      }
      if (data.quizUnlocked) onUnlocked?.();
    });
  }, [video._id]);

  const report = async (event, unlockNow = false) => {
    if (!videoRef.current) return;
    const position = videoRef.current.currentTime || 0;
    const duration = videoRef.current.duration || 0;
    const delta = Math.max(0, position - lastReportedTime.current);
    lastReportedTime.current = position;

    const { data } = await api.post('/progress/video', {
      videoId: video._id,
      courseId,
      positionSeconds: position,
      durationSeconds: duration,
      watchedDeltaSeconds: delta,
      event,
      unlockNow,
    });
    setProgress(data);
    if (data.quizUnlocked) onUnlocked?.();
  };

  const handleManualUnlock = async () => {
    const { data } = await api.post(`/progress/video/${video._id}/unlock`);
    setProgress(data);
    onUnlocked?.();
  };

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={`${process.env.REACT_APP_FILE_URL || 'http://localhost:5000'}${video.url}`}
        controls
        className="w-full rounded-lg bg-black"
        onLoadedMetadata={() => report('heartbeat')}
        onPause={() => report('pause')}
        onSeeked={() => report('replay')}
        onTimeUpdate={() => {
          if (videoRef.current && Math.floor(videoRef.current.currentTime) % 5 === 0) {
            report('heartbeat');
          }
        }}
        onEnded={() => report('heartbeat')}
      />
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="bg-brand-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress.completionPercent}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {progress.completionPercent}% watched
          {progress.quizUnlocked ? ' — quiz unlocked!' : ' — watch 90% to unlock the quiz'}
        </span>
        {!progress.quizUnlocked && (
          <button
            onClick={handleManualUnlock}
            className="text-brand-600 hover:text-brand-700 font-medium underline cursor-pointer"
          >
            Unlock Quiz Now 🔓
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;

