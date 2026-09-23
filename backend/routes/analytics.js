const express = require('express');
const Course = require('../models/Course');
const Video = require('../models/Video');
const { Quiz } = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const VideoProgress = require('../models/VideoProgress');
const { StudentProgress } = require('../models/Misc');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route  GET /api/analytics/teacher  (dashboard summary + per-student table + gradebook + analytics)
router.get('/teacher', protect, authorize('teacher'), async (req, res) => {
  try {
    const User = require('../models/User');
    const courses = await Course.find({ teacher: req.user._id }).populate('students', 'name email lastActive');
    const courseIds = courses.map((c) => c._id);

    const videos = await Video.find({ course: { $in: courseIds } });
    const quizzes = await Quiz.find({ course: { $in: courseIds } });
    const attempts = await QuizAttempt.find({ course: { $in: courseIds } })
      .populate('student', 'name email')
      .populate('quiz', 'title')
      .populate('course', 'title');

    const allStudents = await User.find({ role: 'student' }).select('name email lastActive coursesEnrolled');

    const studentRows = [];
    const processedPairs = new Set();

    let grandWatchSum = 0;
    let watchTrackedStudentsCount = 0;
    let atRiskCount = 0;
    let onTrackCount = 0;
    let highPerformerCount = 0;

    for (const course of courses) {
      const courseVideos = videos.filter((v) => v.course && v.course.toString() === course._id.toString());
      const courseVideoIds = courseVideos.map((v) => v._id);
      const courseQuizzes = quizzes.filter((q) => q.course && q.course.toString() === course._id.toString());
      const courseQuizIds = courseQuizzes.map((q) => q._id);

      // Find all student IDs that have interacted with this course
      const vpStudentIds = await VideoProgress.find({
        $or: [{ course: course._id }, { video: { $in: courseVideoIds } }]
      }).distinct('student');

      const qaStudentIds = attempts
        .filter((a) => a.course && a.course._id.toString() === course._id.toString())
        .map((a) => a.student?._id?.toString())
        .filter(Boolean);

      const courseStudentObjIds = course.students ? course.students.map((s) => s._id.toString()) : [];
      const enrolledStudentObjIds = allStudents
        .filter((s) => s.coursesEnrolled && s.coursesEnrolled.map((cId) => cId.toString()).includes(course._id.toString()))
        .map((s) => s._id.toString());

      // If course has no enrolled students yet, fallback to all registered students for preview
      const combinedStudentIdStrs = Array.from(new Set([
        ...courseStudentObjIds,
        ...enrolledStudentObjIds,
        ...vpStudentIds.map((id) => id.toString()),
        ...qaStudentIds,
      ]));

      // Fallback: if course has no students yet, include registered students
      const finalStudentIdStrs = combinedStudentIdStrs.length > 0
        ? combinedStudentIdStrs
        : allStudents.map((s) => s._id.toString());

      const courseStudentsMap = new Map();
      if (course.students) {
        course.students.forEach((s) => courseStudentsMap.set(s._id.toString(), s));
      }
      for (const sid of finalStudentIdStrs) {
        if (!courseStudentsMap.has(sid)) {
          const userDoc = allStudents.find((u) => u._id.toString() === sid) || await User.findById(sid).select('name email lastActive');
          if (userDoc) courseStudentsMap.set(sid, userDoc);
        }
      }

      for (const [studentIdStr, student] of courseStudentsMap.entries()) {
        const pairKey = `${studentIdStr}_${course._id.toString()}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const videoProgresses = await VideoProgress.find({
          student: student._id,
          $or: [{ course: course._id }, { video: { $in: courseVideoIds } }]
        }).populate('video', 'title');

        const watchedCount = videoProgresses.filter((vp) => vp.isCompleted || vp.completionPercent >= 90).length;
        const totalCourseVideos = courseVideos.length;

        let avgWatch = 0;
        if (totalCourseVideos > 0) {
          const sumWatch = videoProgresses.reduce((sum, vp) => sum + (vp.completionPercent || 0), 0);
          avgWatch = Math.min(100, Math.round(sumWatch / totalCourseVideos));
        } else if (videoProgresses.length > 0) {
          const sumWatch = videoProgresses.reduce((sum, vp) => sum + (vp.completionPercent || 0), 0);
          avgWatch = Math.min(100, Math.round(sumWatch / videoProgresses.length));
        }

        const totalWatchTime = videoProgresses.reduce((s, v) => s + (v.watchedSeconds || 0), 0);
        const pauseCount = videoProgresses.reduce((s, v) => s + (v.pauseCount || 0), 0);
        const replayCount = videoProgresses.reduce((s, v) => s + (v.replayCount || 0), 0);

        if (avgWatch > 0) {
          grandWatchSum += avgWatch;
          watchTrackedStudentsCount++;
        }

        const studentAttempts = attempts.filter(
          (a) => a.student && a.student._id.toString() === studentIdStr &&
                 ((a.course && a.course._id.toString() === course._id.toString()) ||
                  (a.quiz && courseQuizIds.map(qId => qId.toString()).includes(a.quiz._id.toString())))
        );

        const quizScore = studentAttempts.length
          ? Math.round(studentAttempts.reduce((s, a) => s + a.percentage, 0) / studentAttempts.length)
          : 0;

        const hasQuizData = studentAttempts.length > 0;
        const overallProgress = hasQuizData
          ? Math.round((avgWatch * 0.4) + (quizScore * 0.6))
          : avgWatch;

        let learningScore = 'Average';
        if (overallProgress >= 85) learningScore = 'Excellent';
        else if (overallProgress >= 70) learningScore = 'Good';
        else if (overallProgress >= 50) learningScore = 'Average';
        else learningScore = 'Needs Improvement';

        let performancePrediction = 'On track';
        if (quizScore >= 80 && avgWatch >= 70) {
          performancePrediction = 'High Performer';
          highPerformerCount++;
        } else if ((hasQuizData && quizScore < 50) || (avgWatch > 0 && avgWatch < 30)) {
          performancePrediction = 'At risk';
          atRiskCount++;
        } else {
          performancePrediction = 'On track';
          onTrackCount++;
        }

        await StudentProgress.findOneAndUpdate(
          { student: student._id, course: course._id },
          {
            videosCompleted: watchedCount,
            totalVideos: totalCourseVideos,
            avgQuizScore: quizScore,
            overallProgressPercent: overallProgress,
            learningScore,
            performancePrediction,
          },
          { upsert: true, new: true }
        );

        studentRows.push({
          studentId: student._id,
          studentName: student.name || 'Student',
          studentEmail: student.email || '',
          courseId: course._id,
          course: course.title,
          lastActive: student.lastActive,
          videoWatchPercent: avgWatch,
          totalWatchTimeSeconds: totalWatchTime,
          pauseCount,
          replayCount,
          videoCompletionStatus: avgWatch >= 90 ? 'Completed' : avgWatch > 0 ? 'In Progress' : 'Not Started',
          quizzesAttempted: studentAttempts.length,
          totalCourseQuizzes: courseQuizzes.length,
          quizScore,
          overallProgress,
          learningScore,
          performancePrediction,
          quizHistory: studentAttempts.map((a) => ({
            attemptId: a._id,
            quizTitle: a.quiz?.title || 'Quiz',
            totalScore: a.totalScore,
            totalMarks: a.totalMarks,
            percentage: a.percentage,
            aiFeedbackSummary: a.aiFeedbackSummary,
            submittedAt: a.submittedAt,
          })),
          videoBreakdown: videoProgresses.map((vp) => ({
            videoTitle: vp.video?.title || 'Video',
            completionPercent: vp.completionPercent,
            watchedSeconds: vp.watchedSeconds,
            pauseCount: vp.pauseCount,
            replayCount: vp.replayCount,
          })),
        });
      }
    }

    const quizGradebook = attempts.map((a) => ({
      attemptId: a._id,
      studentId: a.student?._id,
      studentName: a.student?.name || 'Unknown Student',
      studentEmail: a.student?.email || '',
      courseId: a.course?._id,
      courseTitle: a.course?.title || 'Course',
      quizId: a.quiz?._id,
      quizTitle: a.quiz?.title || 'Quiz',
      totalScore: a.totalScore,
      totalMarks: a.totalMarks,
      percentage: a.percentage,
      aiFeedbackSummary: a.aiFeedbackSummary,
      submittedAt: a.submittedAt,
    }));

    const quizSummary = quizzes.map((q) => {
      const qAttempts = attempts.filter((a) => a.quiz && a.quiz._id.toString() === q._id.toString());
      const avg = qAttempts.length
        ? Math.round(qAttempts.reduce((s, a) => s + a.percentage, 0) / qAttempts.length)
        : 0;
      const highest = qAttempts.length ? Math.max(...qAttempts.map((a) => a.percentage)) : 0;
      const lowest = qAttempts.length ? Math.min(...qAttempts.map((a) => a.percentage)) : 0;

      return {
        quizId: q._id,
        quizTitle: q.title,
        courseId: q.course,
        totalAttempts: qAttempts.length,
        avgScorePercent: avg,
        highestScorePercent: highest,
        lowestScorePercent: lowest,
      };
    });

    const uniqueStudentsCount = new Set(studentRows.map((s) => s.studentId.toString())).size;

    const averageQuizScore = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
      : 0;

    const averageVideoWatch = watchTrackedStudentsCount
      ? Math.round(grandWatchSum / watchTrackedStudentsCount)
      : 0;

    res.json({
      summary: {
        totalStudents: uniqueStudentsCount,
        totalCourses: courses.length,
        totalVideos: videos.length,
        totalQuizzes: quizzes.length,
        totalQuizAttempts: attempts.length,
        averageQuizScore,
        averageVideoWatch,
        atRiskCount,
        onTrackCount,
        highPerformerCount,
      },
      totalStudents: uniqueStudentsCount,
      totalCourses: courses.length,
      totalVideos: videos.length,
      totalQuizzes: quizzes.length,
      averageScore: averageQuizScore,
      students: studentRows,
      quizGradebook,
      quizSummary,
      courses: courses.map((c) => ({
        id: c._id,
        title: c.title,
        joinCode: c.joinCode,
        studentCount: c.students ? c.students.length : 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load teacher analytics', error: err.message });
  }
});

// @route  GET /api/analytics/student  (student's own dashboard)
router.get('/student', protect, authorize('student'), async (req, res) => {
  try {
    const progressList = await StudentProgress.find({ student: req.user._id }).populate('course', 'title');
    const attempts = await QuizAttempt.find({ student: req.user._id }).populate('quiz', 'title');

    res.json({
      courses: progressList,
      quizHistory: attempts.map((a) => ({
        quizTitle: a.quiz?.title,
        score: a.totalScore,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        feedback: a.aiFeedbackSummary,
        submittedAt: a.submittedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load student analytics', error: err.message });
  }
});

module.exports = router;

