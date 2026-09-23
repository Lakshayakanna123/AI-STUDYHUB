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

    // 1. Fetch teacher's created courses, or fallback to all courses if none specifically assigned
    let courses = await Course.find({ teacher: req.user._id }).populate('students', 'name email lastActive');
    if (!courses || courses.length === 0) {
      courses = await Course.find().populate('students', 'name email lastActive');
    }

    const courseIds = courses.map((c) => c._id);

    // 2. Fetch all videos, quizzes, attempts, and video progress across system
    const videos = await Video.find({ $or: [{ course: { $in: courseIds } }, { course: { $exists: true } }] });
    const quizzes = await Quiz.find({ $or: [{ course: { $in: courseIds } }, { course: { $exists: true } }] });
    const attempts = await QuizAttempt.find()
      .populate('student', 'name email')
      .populate('quiz', 'title')
      .populate('course', 'title');

    const allVideoProgresses = await VideoProgress.find()
      .populate('student', 'name email')
      .populate('video', 'title')
      .populate('course', 'title');

    const allStudents = await User.find({ role: 'student' }).select('name email lastActive coursesEnrolled');

    const studentRows = [];
    const processedPairs = new Set();

    let grandWatchSum = 0;
    let watchTrackedStudentsCount = 0;
    let atRiskCount = 0;
    let onTrackCount = 0;
    let highPerformerCount = 0;

    const targetCourses = courses.length > 0
      ? courses
      : [{ _id: 'general', title: 'General Classroom', students: allStudents }];

    for (const course of targetCourses) {
      const isVirtual = course._id === 'general';
      const cIdStr = isVirtual ? 'general' : course._id.toString();

      const courseVideos = videos.filter((v) => isVirtual || (v.course && v.course.toString() === cIdStr));
      const courseVideoIds = courseVideos.map((v) => v._id.toString());
      const courseQuizzes = quizzes.filter((q) => isVirtual || (q.course && q.course.toString() === cIdStr));
      const courseQuizIds = courseQuizzes.map((q) => q._id.toString());

      const vpStudentIds = allVideoProgresses
        .filter((vp) => isVirtual || (vp.course && vp.course._id?.toString() === cIdStr) || (vp.video && courseVideoIds.includes(vp.video._id?.toString())))
        .map((vp) => vp.student?._id?.toString())
        .filter(Boolean);

      const qaStudentIds = attempts
        .filter((a) => isVirtual || (a.course && a.course._id?.toString() === cIdStr) || (a.quiz && courseQuizIds.includes(a.quiz._id?.toString())))
        .map((a) => a.student?._id?.toString())
        .filter(Boolean);

      const courseStudentObjIds = course.students ? course.students.map((s) => s._id.toString()) : [];
      const enrolledStudentObjIds = allStudents
        .filter((s) => s.coursesEnrolled && s.coursesEnrolled.map((cId) => cId.toString()).includes(cIdStr))
        .map((s) => s._id.toString());

      const allRegisteredIds = allStudents.map((s) => s._id.toString());

      const combinedStudentIdStrs = Array.from(new Set([
        ...courseStudentObjIds,
        ...enrolledStudentObjIds,
        ...vpStudentIds,
        ...qaStudentIds,
        ...allRegisteredIds,
      ]));

      const courseStudentsMap = new Map();
      if (course.students && Array.isArray(course.students)) {
        course.students.forEach((s) => s && s._id && courseStudentsMap.set(s._id.toString(), s));
      }
      for (const sid of combinedStudentIdStrs) {
        if (!courseStudentsMap.has(sid)) {
          const userDoc = allStudents.find((u) => u._id.toString() === sid) || await User.findById(sid).select('name email lastActive');
          if (userDoc) courseStudentsMap.set(sid, userDoc);
        }
      }

      for (const [studentIdStr, student] of courseStudentsMap.entries()) {
        const pairKey = `${studentIdStr}_${cIdStr}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const studentVps = allVideoProgresses.filter((vp) => {
          if (!vp.student || vp.student._id.toString() !== studentIdStr) return false;
          if (isVirtual) return true;
          return (vp.course && vp.course._id?.toString() === cIdStr) ||
                 (vp.video && courseVideoIds.includes(vp.video._id?.toString()));
        });

        const watchedCount = studentVps.filter((vp) => vp.isCompleted || vp.completionPercent >= 90).length;
        const totalCourseVideos = courseVideos.length;

        let avgWatch = 0;
        if (totalCourseVideos > 0) {
          const sumWatch = studentVps.reduce((sum, vp) => sum + (vp.completionPercent || 0), 0);
          avgWatch = Math.min(100, Math.round(sumWatch / totalCourseVideos));
        } else if (studentVps.length > 0) {
          const sumWatch = studentVps.reduce((sum, vp) => sum + (vp.completionPercent || 0), 0);
          avgWatch = Math.min(100, Math.round(sumWatch / studentVps.length));
        }

        const totalWatchTime = studentVps.reduce((s, v) => s + (v.watchedSeconds || 0), 0);
        const pauseCount = studentVps.reduce((s, v) => s + (v.pauseCount || 0), 0);
        const replayCount = studentVps.reduce((s, v) => s + (v.replayCount || 0), 0);

        if (avgWatch > 0) {
          grandWatchSum += avgWatch;
          watchTrackedStudentsCount++;
        }

        const studentAttempts = attempts.filter((a) => {
          if (!a.student || a.student._id.toString() !== studentIdStr) return false;
          if (isVirtual) return true;
          return (a.course && a.course._id?.toString() === cIdStr) ||
                 (a.quiz && courseQuizIds.includes(a.quiz._id?.toString()));
        });

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

        if (!isVirtual && course._id) {
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
        }

        studentRows.push({
          studentId: student._id,
          studentName: student.name || 'Student',
          studentEmail: student.email || '',
          courseId: cIdStr,
          course: course.title || 'Course',
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
          videoBreakdown: studentVps.map((vp) => ({
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

