import mongoose from "mongoose";
import crypto from "node:crypto";
import { hashPassword } from "../utils/security.js";

import AcademicYear from "../models/AcademicYear.js";
import AdmissionApplication from "../models/AdmissionApplication.js";
import Assignment from "../models/Assignment.js";
import Attendance from "../models/Attendance.js";
import AttendanceSession from "../models/AttendanceSession.js";
import ClassSection from "../models/ClassSection.js";
import Department from "../models/Department.js";
import Enrollment from "../models/Enrollment.js";
import Exam from "../models/Exam.js";
import FaceAttendanceLog from "../models/FaceAttendanceLog.js";
import FaceData from "../models/FaceData.js";
import FeeInvoice from "../models/FeeInvoice.js";
import Grade from "../models/Grade.js";
import Marks from "../models/Marks.js";
import Message from "../models/Message.js";
import Notice from "../models/Notice.js";
import Payment from "../models/Payment.js";
import Payroll from "../models/Payroll.js";
import Semester from "../models/Semester.js";
import SemesterFee from "../models/SemesterFee.js";
import Subject from "../models/Subject.js";
import Submission from "../models/Submission.js";
import Timetable from "../models/Timetable.js";
import User from "../models/User.js";

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/edunexus360";
const seedPasswords = {
  admin: process.env.SEED_ADMIN_PASSWORD,
  faculty: process.env.SEED_FACULTY_PASSWORD,
  student: process.env.SEED_STUDENT_PASSWORD
};

const SECTION_LABELS = ["A", "B", "C", "D"];
const STUDENTS_PER_SECTION = 20;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = [
  ["09:00", "10:00"],
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["12:00", "13:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"]
];

const COURSE_CONFIGS = [
  {
    code: "BCA",
    departmentName: "Computer Applications",
    departmentCode: "BCA",
    feeBase: 28000,
    subjects: {
      1: [
        "Programming Fundamentals",
        "Digital Logic",
        "Computer Organization",
        "Business Communication",
        "Mathematics for Computing"
      ],
      2: [
        "Data Structures",
        "Database Management Systems",
        "Object Oriented Programming",
        "Web Design",
        "Discrete Mathematics"
      ],
      3: [
        "Operating Systems",
        "Computer Networks",
        "Software Engineering",
        "Java Programming",
        "Data Analytics Basics"
      ]
    }
  },
  {
    code: "BSC",
    departmentName: "Bachelor of Science",
    departmentCode: "BSC",
    feeBase: 26000,
    subjects: {
      1: [
        "Physics Mechanics",
        "Chemistry Fundamentals",
        "Mathematics I",
        "Environmental Science",
        "Computer Fundamentals"
      ],
      2: [
        "Electricity and Magnetism",
        "Organic Chemistry",
        "Mathematics II",
        "Scientific Computing",
        "Statistics Basics"
      ],
      3: [
        "Thermodynamics",
        "Inorganic Chemistry",
        "Linear Algebra",
        "Research Methodology",
        "Data Handling Lab"
      ]
    }
  }
];

const FACULTY_PROFILES = [
  ["Dr. Priya Sharma", "Assistant Professor", 65000],
  ["Prof. Karan Mehta", "Associate Professor", 78000],
  ["Dr. Neha Verma", "Assistant Professor", 64000],
  ["Prof. Aman Gupta", "Senior Lecturer", 59000],
  ["Dr. Sonia Rao", "Assistant Professor", 66000],
  ["Prof. Rahul Jain", "Lecturer", 54000],
  ["Dr. Meenakshi Iyer", "Associate Professor", 76000],
  ["Prof. Vikram Sethi", "Assistant Professor", 62000],
  ["Dr. Farhan Ali", "Senior Lecturer", 61000],
  ["Prof. Kavita Menon", "Lecturer", 55000]
];

const FIRST_NAMES = [
  "Aarav",
  "Aditi",
  "Aditya",
  "Ananya",
  "Arjun",
  "Avni",
  "Dev",
  "Diya",
  "Eshan",
  "Ira",
  "Kabir",
  "Kavya",
  "Krish",
  "Meera",
  "Mihir",
  "Naina",
  "Neel",
  "Nisha",
  "Pranav",
  "Riya",
  "Rohan",
  "Saanvi",
  "Shaurya",
  "Siya",
  "Tanvi",
  "Ved",
  "Vivaan",
  "Yash",
  "Zoya",
  "Ishaan"
];

const LAST_NAMES = [
  "Sharma",
  "Patel",
  "Singh",
  "Gupta",
  "Verma",
  "Rao",
  "Mehta",
  "Nair",
  "Das",
  "Joshi",
  "Kapoor",
  "Khan",
  "Mishra",
  "Bose",
  "Jain",
  "Reddy",
  "Saxena",
  "Malhotra",
  "Chopra",
  "Iyer"
];

const clearAllData = async () => {
  const models = [
    Submission,
    Assignment,
    FaceAttendanceLog,
    AttendanceSession,
    FaceData,
    Timetable,
    Enrollment,
    Attendance,
    Marks,
    Grade,
    Exam,
    Payment,
    FeeInvoice,
    SemesterFee,
    Message,
    Notice,
    Payroll,
    AdmissionApplication,
    Subject,
    ClassSection,
    Semester,
    AcademicYear,
    Department,
    User
  ];

  for (const model of models) {
    await model.deleteMany({});
  }
};

const asDate = (value) => new Date(`${value}T00:00:00.000Z`);

const keyFor = (course, semester, section = "") =>
  [course, `S${semester}`, section].filter(Boolean).join("-");

const getStudentName = (index) => {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
};

const getSemesterDates = (semester) => {
  const ranges = {
    1: ["2026-04-01", "2026-07-31"],
    2: ["2026-08-01", "2026-11-30"],
    3: ["2026-12-01", "2027-03-31"]
  };
  return ranges[semester];
};

const getAttendanceDates = (semester) => {
  const dates = {
    1: ["2026-04-08", "2026-04-15"],
    2: ["2026-08-05", "2026-08-12"],
    3: ["2026-12-09", "2026-12-16"]
  };
  return dates[semester];
};

const getDueDate = (semester, offsetDays = 0) => {
  const baseDates = {
    1: "2026-05-20",
    2: "2026-09-20",
    3: "2027-01-20"
  };
  const date = asDate(baseDates[semester]);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
};

const buildFacultyDocs = (password) =>
  FACULTY_PROFILES.map(([name, designation]) => {
    const emailName = name
      .toLowerCase()
      .replace(/^(dr|prof)\.?\s+/, "")
      .replace(/\s+/g, ".");

    return {
      name,
      email: `${emailName}@edunexus.com`,
      password,
      role: "faculty",
      designation,
      subjects: []
    };
  });

const seed = async () => {
  await mongoose.connect(mongoUri);
  console.log(`Connected to ${mongoUri}`);

  await clearAllData();
  console.log("Existing data cleared.");

  const [adminPassword, facultyPassword, studentPassword] = await Promise.all([
    hashPassword(seedPasswords.admin || crypto.randomUUID()),
    hashPassword(seedPasswords.faculty || crypto.randomUUID()),
    hashPassword(seedPasswords.student || crypto.randomUUID())
  ]);

  const admin = await User.create({
    name: "Admin User",
    email: "admin@edunexus.com",
    password: adminPassword,
    role: "admin"
  });

  const faculties = await User.insertMany(buildFacultyDocs(facultyPassword));

  const academicYear = await AcademicYear.create({
    name: "2026-27",
    startDate: asDate("2026-04-01"),
    endDate: asDate("2027-03-31"),
    isActive: true
  });

  const semesters = await Semester.insertMany(
    [1, 2, 3].map((number) => {
      const [startDate, endDate] = getSemesterDates(number);
      return {
        name: `Semester ${number}`,
        number,
        academicYearId: academicYear._id,
        startDate: asDate(startDate),
        endDate: asDate(endDate)
      };
    })
  );

  const semesterByNumber = new Map(semesters.map((semester) => [semester.number, semester]));

  const departments = await Department.insertMany(
    COURSE_CONFIGS.map((course) => ({
      name: course.departmentName,
      code: course.departmentCode
    }))
  );
  const departmentByCourse = new Map(
    COURSE_CONFIGS.map((course, index) => [course.code, departments[index]])
  );

  const sectionDocs = [];
  const sectionMeta = [];
  for (const course of COURSE_CONFIGS) {
    for (const semester of [1, 2, 3]) {
      SECTION_LABELS.forEach((section, sectionIndex) => {
        sectionMeta.push({ course: course.code, semester, section, sectionIndex });
        sectionDocs.push({
          name: `${course.code} Sem ${semester}-${section}`,
          departmentId: departmentByCourse.get(course.code)._id,
          semesterId: semesterByNumber.get(semester)._id,
          coordinatorId: faculties[(semester + sectionIndex) % faculties.length]._id,
          capacity: STUDENTS_PER_SECTION
        });
      });
    }
  }

  const classSections = await ClassSection.insertMany(sectionDocs);
  const sectionByKey = new Map(
    classSections.map((section, index) => {
      const meta = sectionMeta[index];
      return [keyFor(meta.course, meta.semester, meta.section), { ...meta, doc: section }];
    })
  );

  const subjectDocs = [];
  const subjectMeta = [];
  let subjectCursor = 0;
  for (const course of COURSE_CONFIGS) {
    for (const semester of [1, 2, 3]) {
      for (const name of course.subjects[semester]) {
        const faculty = faculties[subjectCursor % faculties.length];
        subjectMeta.push({ course: course.code, semester, facultyId: faculty._id, name });
        subjectDocs.push({
          course: course.code,
          semester,
          name,
          facultyId: faculty._id
        });
        subjectCursor += 1;
      }
    }
  }

  const subjects = await Subject.insertMany(subjectDocs);
  const subjectsByCourseSemester = new Map();
  subjects.forEach((subject, index) => {
    const meta = subjectMeta[index];
    const mapKey = keyFor(meta.course, meta.semester);
    const rows = subjectsByCourseSemester.get(mapKey) || [];
    rows.push(subject);
    subjectsByCourseSemester.set(mapKey, rows);
  });

  await Promise.all(
    faculties.map((faculty) => {
      const assignedSubjects = subjects
        .filter((subject) => String(subject.facultyId) === String(faculty._id))
        .map((subject) => `${subject.course} Sem ${subject.semester}: ${subject.name}`);
      return User.updateOne({ _id: faculty._id }, { $set: { subjects: assignedSubjects } });
    })
  );

  const timetableDocs = [];
  for (const sectionRow of sectionByKey.values()) {
    const sectionSubjects = subjectsByCourseSemester.get(
      keyFor(sectionRow.course, sectionRow.semester)
    );

    sectionSubjects.forEach((subject, subjectIndex) => {
      const [startTime, endTime] = TIME_SLOTS[
        (subjectIndex + sectionRow.sectionIndex) % TIME_SLOTS.length
      ];
      timetableDocs.push({
        classSectionId: sectionRow.doc._id,
        subjectId: subject._id,
        facultyId: subject.facultyId,
        dayOfWeek: DAYS[(subjectIndex + sectionRow.semester + sectionRow.sectionIndex) % DAYS.length],
        startTime,
        endTime,
        room: `${sectionRow.course}-${sectionRow.semester}${sectionRow.section}`
      });
    });
  }
  await Timetable.insertMany(timetableDocs);

  const studentDocs = [];
  const studentMeta = [];
  let globalStudentIndex = 0;
  for (const sectionRow of sectionByKey.values()) {
    for (let localIndex = 1; localIndex <= STUDENTS_PER_SECTION; localIndex += 1) {
      const rollNumber = `${sectionRow.course}-S${sectionRow.semester}-${String(
        sectionRow.sectionIndex * STUDENTS_PER_SECTION + localIndex
      ).padStart(3, "0")}`;
      const email = `${sectionRow.course.toLowerCase()}.s${sectionRow.semester}.${sectionRow.section.toLowerCase()}.${String(
        localIndex
      ).padStart(2, "0")}@edunexus.com`;
      const name = getStudentName(globalStudentIndex);

      studentMeta.push({
        course: sectionRow.course,
        semester: sectionRow.semester,
        section: sectionRow.section,
        sectionKey: keyFor(sectionRow.course, sectionRow.semester, sectionRow.section),
        localIndex,
        globalIndex: globalStudentIndex
      });
      studentDocs.push({
        name,
        email,
        password: studentPassword,
        role: "student",
        course: sectionRow.course,
        semester: sectionRow.semester,
        rollNumber,
        universityRollNumber: `EDU-2026-${rollNumber}`
      });
      globalStudentIndex += 1;
    }
  }

  const students = await User.insertMany(studentDocs);
  const studentRows = students.map((student, index) => ({ user: student, ...studentMeta[index] }));

  await Enrollment.insertMany(
    studentRows.map((row) => ({
      studentId: row.user._id,
      classSectionId: sectionByKey.get(row.sectionKey).doc._id,
      status: "active",
      enrolledOn: asDate("2026-04-01")
    }))
  );

  const semesterFees = await SemesterFee.insertMany(
    COURSE_CONFIGS.flatMap((course) =>
      [1, 2, 3].map((semester) => ({
        title: `${course.code} Semester ${semester} Tuition Fee`,
        course: course.code,
        semester,
        amount: course.feeBase + semester * 1000,
        dueDaysAfterIssue: 30,
        active: true
      }))
    )
  );

  const feeByCourseSemester = new Map(
    semesterFees.map((fee) => [keyFor(fee.course, fee.semester), fee])
  );

  const invoiceDocs = studentRows.map((row) => {
    const fee = feeByCourseSemester.get(keyFor(row.course, row.semester));
    const statusCycle = row.globalIndex % 4;
    const paidAmount =
      statusCycle === 0 ? fee.amount : statusCycle === 1 ? Math.round(fee.amount * 0.45) : 0;
    const status =
      statusCycle === 0
        ? "paid"
        : statusCycle === 1
          ? "partially_paid"
          : statusCycle === 2
            ? "pending"
            : "overdue";

    return {
      studentId: row.user._id,
      semesterFeeId: fee._id,
      title: fee.title,
      invoiceNumber: `INV-${row.course}-S${row.semester}-${String(row.globalIndex + 1).padStart(
        4,
        "0"
      )}`,
      course: row.course,
      semester: row.semester,
      amount: fee.amount,
      paidAmount,
      dueDate: status === "overdue" ? asDate("2026-04-20") : getDueDate(row.semester, 10),
      status
    };
  });

  const invoices = await FeeInvoice.insertMany(invoiceDocs);
  await Payment.insertMany(
    invoices
      .filter((invoice) => invoice.paidAmount > 0)
      .map((invoice, index) => ({
        feeInvoiceId: invoice._id,
        studentId: invoice.studentId,
        amount: invoice.paidAmount,
        paymentDate: asDate(index % 2 === 0 ? "2026-04-18" : "2026-04-22"),
        method: ["upi", "card", "bank"][index % 3],
        transactionRef: `PAY-${String(index + 1).padStart(5, "0")}`
      }))
  );

  const attendanceDocs = [];
  const marksDocs = [];
  for (const row of studentRows) {
    const sectionSubjects = subjectsByCourseSemester.get(keyFor(row.course, row.semester));
    sectionSubjects.forEach((subject, subjectIndex) => {
      marksDocs.push({
        studentId: row.user._id,
        subjectId: subject._id,
        subject: subject.name,
        marks: 55 + ((row.globalIndex * 7 + subjectIndex * 11 + row.semester * 3) % 41),
        teacherId: subject.facultyId
      });

      getAttendanceDates(row.semester).forEach((date, sessionIndex) => {
        attendanceDocs.push({
          studentId: row.user._id,
          subjectId: subject._id,
          subject: subject.name,
          status: (row.globalIndex + subjectIndex + sessionIndex) % 9 === 0 ? "absent" : "present",
          teacherId: subject.facultyId,
          date: asDate(date)
        });
      });
    });
  }
  await Attendance.insertMany(attendanceDocs);
  await Marks.insertMany(marksDocs);

  const assignmentDocs = [];
  const assignmentMeta = [];
  for (const sectionRow of sectionByKey.values()) {
    const sectionSubjects = subjectsByCourseSemester
      .get(keyFor(sectionRow.course, sectionRow.semester))
      .slice(0, 2);

    sectionSubjects.forEach((subject, subjectIndex) => {
      assignmentMeta.push({
        sectionKey: keyFor(sectionRow.course, sectionRow.semester, sectionRow.section),
        subjectIndex
      });
      assignmentDocs.push({
        title: `${subject.name} Assignment ${subjectIndex + 1}`,
        description: `Complete the practical and theory questions for ${subject.name}.`,
        subjectId: subject._id,
        facultyId: subject.facultyId,
        classSectionId: sectionRow.doc._id,
        dueDate: getDueDate(sectionRow.semester, subjectIndex * 7),
        attachmentUrl: ""
      });
    });
  }
  const assignments = await Assignment.insertMany(assignmentDocs);

  const submissionDocs = [];
  assignments.forEach((assignment, index) => {
    const meta = assignmentMeta[index];
    const sectionStudents = studentRows.filter((row) => row.sectionKey === meta.sectionKey);
    sectionStudents.slice(0, 14).forEach((row) => {
      submissionDocs.push({
        assignmentId: assignment._id,
        studentId: row.user._id,
        content: `Submitted work by ${row.user.name} for ${assignment.title}.`,
        submittedAt: getDueDate(row.semester, -2 + (row.localIndex % 3)),
        grade: 60 + ((row.globalIndex + meta.subjectIndex * 9) % 36),
        feedback: row.localIndex % 5 === 0 ? "Good effort. Add more examples." : "Checked."
      });
    });
  });
  await Submission.insertMany(submissionDocs);

  const examDocs = [];
  const examMeta = [];
  for (const sectionRow of sectionByKey.values()) {
    const sectionSubjects = subjectsByCourseSemester.get(
      keyFor(sectionRow.course, sectionRow.semester)
    );
    sectionSubjects.forEach((subject, subjectIndex) => {
      examMeta.push({
        sectionKey: keyFor(sectionRow.course, sectionRow.semester, sectionRow.section),
        subjectIndex
      });
      examDocs.push({
        name: `${subject.name} Mid Term`,
        subjectId: subject._id,
        classSectionId: sectionRow.doc._id,
        examDate: getDueDate(sectionRow.semester, 18 + subjectIndex),
        totalMarks: 50,
        type: "midterm"
      });
    });
  }
  const exams = await Exam.insertMany(examDocs);

  const gradeDocs = [];
  exams.forEach((exam, index) => {
    const meta = examMeta[index];
    const sectionStudents = studentRows.filter((row) => row.sectionKey === meta.sectionKey);
    sectionStudents.forEach((row) => {
      gradeDocs.push({
        examId: exam._id,
        studentId: row.user._id,
        marksObtained: 26 + ((row.globalIndex * 5 + meta.subjectIndex * 3) % 23),
        remarks: row.localIndex % 6 === 0 ? "Needs revision" : "Satisfactory"
      });
    });
  });
  await Grade.insertMany(gradeDocs);

  await Payroll.insertMany(
    faculties.flatMap((faculty, facultyIndex) =>
      ["2026-04", "2026-05", "2026-06"].map((month, monthIndex) => ({
        facultyId: faculty._id,
        month,
        amount: FACULTY_PROFILES[facultyIndex][2],
        status: monthIndex === 0 ? "paid" : "pending",
        paidOn: monthIndex === 0 ? asDate("2026-04-30") : undefined
      }))
    )
  );

  const firstSection = classSections[0];
  await Notice.insertMany([
    {
      title: "Welcome to Academic Year 2026-27",
      body: "BCA and BSC classes have been scheduled. Students should check timetable and fee invoices.",
      audience: "all",
      createdBy: admin._id
    },
    {
      title: "Face Enrollment Required",
      body: "Students must complete face enrollment before using face attendance.",
      audience: "students",
      createdBy: admin._id
    },
    {
      title: "Faculty Timetable Review",
      body: "Faculty members should verify their assigned subjects and timetable slots.",
      audience: "faculty",
      createdBy: admin._id
    },
    {
      title: "Section Orientation",
      body: "Orientation for this section will be held in the assigned classroom.",
      audience: "class",
      classSectionId: firstSection._id,
      createdBy: admin._id
    }
  ]);

  const messageDocs = [
    {
      fromUserId: admin._id,
      content: "Welcome to EduNexus360. Your course data, timetable, fees, and academic records are ready.",
      isBroadcast: true
    },
    {
      fromUserId: faculties[0]._id,
      classSectionId: firstSection._id,
      content: "Please review the first assignment and submit it before the due date.",
      isBroadcast: true
    }
  ];

  studentRows.slice(0, 20).forEach((row, index) => {
    messageDocs.push({
      fromUserId: faculties[index % faculties.length]._id,
      toUserId: row.user._id,
      content:
        index % 2 === 0
          ? "Your academic performance is good. Keep attending classes regularly."
          : "Please improve attendance and complete pending submissions.",
      isBroadcast: false
    });
  });
  await Message.insertMany(messageDocs);

  await AdmissionApplication.insertMany(
    COURSE_CONFIGS.flatMap((course, courseIndex) =>
      Array.from({ length: 6 }, (_, index) => ({
        applicantName: `Applicant ${course.code} ${index + 1}`,
        email: `applicant.${course.code.toLowerCase()}.${index + 1}@demo.com`,
        phone: `99999${courseIndex}${String(index + 1).padStart(4, "0")}`,
        desiredDepartmentId: departmentByCourse.get(course.code)._id,
        status: ["new", "reviewed", "accepted", "rejected"][index % 4],
        notes: `Sample admission application for ${course.code}.`
      }))
    )
  );

  const counts = {
    admins: 1,
    faculty: faculties.length,
    courses: COURSE_CONFIGS.length,
    semesters: semesters.length,
    sections: classSections.length,
    students: students.length,
    subjects: subjects.length,
    timetables: timetableDocs.length,
    enrollments: studentRows.length,
    attendance: attendanceDocs.length,
    marks: marksDocs.length,
    assignments: assignments.length,
    submissions: submissionDocs.length,
    exams: exams.length,
    grades: gradeDocs.length,
    invoices: invoices.length
  };

  console.log("Full sample data inserted successfully.");
  console.table(counts);
  console.log("\nSeed complete.");
  console.log("Set SEED_ADMIN_PASSWORD, SEED_FACULTY_PASSWORD, and SEED_STUDENT_PASSWORD before seeding if you need known login passwords.");

  await mongoose.disconnect();
  console.log("Done.");
};

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
