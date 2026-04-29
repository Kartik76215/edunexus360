import mongoose from "mongoose";
import { hashPassword } from "../utils/security.js";
import { todayDateKey } from "../utils/faceAttendance.js";

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

const PASSWORDS = {
  admin: process.env.SEED_ADMIN_PASSWORD || "admin123",
  faculty: process.env.SEED_FACULTY_PASSWORD || "faculty123",
  student: process.env.SEED_STUDENT_PASSWORD || "student123"
};

const MODELS_TO_CLEAR = [
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

const COURSES = [
  {
    code: "BCA",
    departmentName: "Computer Applications",
    feeBase: 22000,
    subjects: {
      1: [
        "Programming Fundamentals",
        "Digital Logic",
        "Communication Skills",
        "Computer Organization",
        "Mathematics for Computing",
        "Office Automation Lab"
      ],
      2: [
        "Data Structures",
        "Database Management Systems",
        "Web Foundations",
        "Object Oriented Programming",
        "Discrete Mathematics",
        "Database Lab"
      ]
    }
  },
  {
    code: "BSC",
    departmentName: "Science",
    feeBase: 18000,
    subjects: {
      1: [
        "Physics Mechanics",
        "Chemistry Fundamentals",
        "Mathematics I",
        "Environmental Science",
        "Scientific Communication",
        "Physics Lab"
      ],
      2: [
        "Electricity and Magnetism",
        "Organic Chemistry",
        "Mathematics II",
        "Statistics Basics",
        "Scientific Computing",
        "Chemistry Lab"
      ]
    }
  }
];

const FACULTY_SEED = [
  ["Dr. Priya Sharma", "Assistant Professor", "priya.sharma@edunexus.com", 65000],
  ["Prof. Karan Mehta", "Associate Professor", "karan.mehta@edunexus.com", 76000],
  ["Dr. Neha Verma", "Assistant Professor", "neha.verma@edunexus.com", 64000],
  ["Prof. Aman Gupta", "Senior Lecturer", "aman.gupta@edunexus.com", 59000],
  ["Dr. Sonia Rao", "Assistant Professor", "sonia.rao@edunexus.com", 66000],
  ["Prof. Rahul Jain", "Lecturer", "rahul.jain@edunexus.com", 54000],
  ["Dr. Meenakshi Iyer", "Associate Professor", "meenakshi.iyer@edunexus.com", 78000],
  ["Prof. Vikram Sethi", "Assistant Professor", "vikram.sethi@edunexus.com", 62000],
  ["Dr. Farhan Ali", "Senior Lecturer", "farhan.ali@edunexus.com", 61000],
  ["Prof. Kavita Menon", "Lecturer", "kavita.menon@edunexus.com", 55000],
  ["Dr. Harsh Vardhan", "Assistant Professor", "harsh.vardhan@edunexus.com", 63000],
  ["Prof. Ritu Malhotra", "Senior Lecturer", "ritu.malhotra@edunexus.com", 60000]
];

const STUDENT_NAMES = [
  "Aarav Sharma",
  "Aditi Patel",
  "Kabir Singh",
  "Meera Rao",
  "Rohan Mehta",
  "Siya Verma",
  "Dev Nair",
  "Nisha Jain",
  "Ishaan Das",
  "Kavya Iyer",
  "Arjun Gupta",
  "Diya Kapoor",
  "Ved Joshi",
  "Avni Reddy",
  "Mihir Bose",
  "Tanvi Khan",
  "Shaurya Saxena",
  "Riya Chopra",
  "Neel Malhotra",
  "Zoya Mishra",
  "Pranav Rao",
  "Saanvi Nair",
  "Eshan Jain",
  "Ira Sharma",
  "Krish Patel",
  "Ananya Singh",
  "Vivaan Das",
  "Naina Iyer",
  "Yash Mehta",
  "Nitya Verma",
  "Reyansh Gupta",
  "Myra Kapoor",
  "Atharv Joshi",
  "Anika Reddy",
  "Dhruv Bose",
  "Sara Khan",
  "Rudra Saxena",
  "Kiara Chopra",
  "Om Malhotra",
  "Tara Mishra"
];

const SECTIONS = ["A", "B"];
const SEMESTERS = [1, 2];
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

const asDate = (value) => new Date(`${value}T00:00:00.000Z`);
const sectionKey = (course, semester, section) => `${course}-S${semester}-${section}`;
const courseSemesterKey = (course, semester) => `${course}-S${semester}`;

const formatTime = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");

const getStudentName = (index) => {
  const baseName = STUDENT_NAMES[index % STUDENT_NAMES.length];
  const batch = Math.floor(index / STUDENT_NAMES.length) + 1;
  return batch === 1 ? baseName : `${baseName} ${batch}`;
};

const getLiveSlot = () => {
  const now = new Date();
  const start = new Date(now.getTime() - 5 * 60 * 1000);
  const end = new Date(now.getTime() + 55 * 60 * 1000);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];

  return {
    dayOfWeek: day === "Sun" ? "Mon" : day,
    startTime: formatTime(start),
    endTime: formatTime(end)
  };
};

const clearAllData = async () => {
  for (const model of MODELS_TO_CLEAR) {
    await model.deleteMany({});
  }
};

const seed = async () => {
  await mongoose.connect(mongoUri);
  console.log(`Connected to ${mongoUri}`);

  await clearAllData();
  console.log("All previous ERP data cleared.");

  const [adminPassword, facultyPassword, studentPassword] = await Promise.all([
    hashPassword(PASSWORDS.admin),
    hashPassword(PASSWORDS.faculty),
    hashPassword(PASSWORDS.student)
  ]);

  const admin = await User.create({
    name: "System Admin",
    email: "admin@edunexus.com",
    password: adminPassword,
    role: "admin"
  });

  const faculty = await User.insertMany(
    FACULTY_SEED.map(([name, designation, email]) => ({
      name,
      email,
      password: facultyPassword,
      role: "faculty",
      designation,
      subjects: []
    }))
  );

  const academicYear = await AcademicYear.create({
    name: "2026-27",
    startDate: asDate("2026-04-01"),
    endDate: asDate("2027-03-31"),
    isActive: true
  });

  const semesters = await Semester.insertMany(
    SEMESTERS.map((number) => ({
      name: `Semester ${number}`,
      number,
      academicYearId: academicYear._id,
      startDate: number === 1 ? asDate("2026-04-01") : asDate("2026-08-01"),
      endDate: number === 1 ? asDate("2026-07-31") : asDate("2026-11-30")
    }))
  );
  const semesterByNumber = new Map(semesters.map((semester) => [semester.number, semester]));

  const departments = await Department.insertMany(
    COURSES.map((course) => ({
      name: course.departmentName,
      code: course.code
    }))
  );
  const departmentByCode = new Map(departments.map((department) => [department.code, department]));

  const sectionSeed = COURSES.flatMap((course, courseIndex) =>
    SEMESTERS.flatMap((semester) =>
      SECTIONS.map((section, sectionIndex) => ({
        course: course.code,
        semester,
        section,
        name: `${course.code} Sem ${semester}-${section}`,
        coordinatorIndex: (courseIndex * 4 + (semester - 1) * 2 + sectionIndex) % faculty.length
      }))
    )
  );

  const classSections = await ClassSection.insertMany(
    sectionSeed.map((row) => ({
      name: row.name,
      departmentId: departmentByCode.get(row.course)._id,
      semesterId: semesterByNumber.get(row.semester)._id,
      coordinatorId: faculty[row.coordinatorIndex]._id,
      capacity: 60
    }))
  );
  const sectionByKey = new Map(
    classSections.map((section, index) => {
      const row = sectionSeed[index];
      return [sectionKey(row.course, row.semester, row.section), { ...row, doc: section }];
    })
  );

  const subjectSeed = [];
  let subjectFacultyIndex = 0;
  for (const course of COURSES) {
    for (const semester of SEMESTERS) {
      for (const name of course.subjects[semester]) {
        subjectSeed.push({
          course: course.code,
          semester,
          name,
          facultyIndex: subjectFacultyIndex % faculty.length
        });
        subjectFacultyIndex += 1;
      }
    }
  }

  const subjects = await Subject.insertMany(
    subjectSeed.map((row) => ({
      course: row.course,
      semester: row.semester,
      name: row.name,
      facultyId: faculty[row.facultyIndex]._id
    }))
  );
  const subjectsByCourseSemester = new Map();
  subjects.forEach((subject) => {
    const key = courseSemesterKey(subject.course, subject.semester);
    subjectsByCourseSemester.set(key, [...(subjectsByCourseSemester.get(key) || []), subject]);
  });

  await Promise.all(
    faculty.map((member) => {
      const assignedSubjects = subjects
        .filter((subject) => String(subject.facultyId) === String(member._id))
        .map((subject) => `${subject.course} Sem ${subject.semester}: ${subject.name}`);
      return User.updateOne({ _id: member._id }, { $set: { subjects: assignedSubjects } });
    })
  );

  const studentDocs = [];
  const studentMeta = [];
  let studentIndex = 0;
  for (const course of COURSES) {
    for (const semester of SEMESTERS) {
      for (const section of SECTIONS) {
        for (let roll = 1; roll <= STUDENTS_PER_SECTION; roll += 1) {
          const name = getStudentName(studentIndex);
          const rollNumber = `${section}${String(roll).padStart(3, "0")}`;
          const universityRollNumber = `UNI-${course.code}-2026-S${semester}${section}-${String(roll).padStart(3, "0")}`;
          const email = `${slug(name)}.${course.code.toLowerCase()}s${semester}${section.toLowerCase()}.${String(
            roll
          ).padStart(2, "0")}@edunexus.com`;

          studentDocs.push({
            name,
            email,
            password: studentPassword,
            role: "student",
            course: course.code,
            semester,
            section,
            rollNumber,
            universityRollNumber
          });
          studentMeta.push({ course: course.code, semester, section });
          studentIndex += 1;
        }
      }
    }
  }

  const students = await User.insertMany(studentDocs);
  const studentRows = students.map((student, index) => {
    const meta = studentMeta[index];
    return {
      user: student,
      ...meta,
      classSection: sectionByKey.get(sectionKey(meta.course, meta.semester, meta.section)).doc
    };
  });

  await Enrollment.insertMany(
    studentRows.map((row) => ({
      studentId: row.user._id,
      classSectionId: row.classSection._id,
      status: "active",
      enrolledOn: asDate("2026-04-01")
    }))
  );

  const liveSlot = getLiveSlot();
  const timetableDocs = [];
  let timetableCursor = 0;

  for (const sectionRow of sectionByKey.values()) {
    const sectionSubjects = subjectsByCourseSemester.get(
      courseSemesterKey(sectionRow.course, sectionRow.semester)
    );

    sectionSubjects.forEach((subject, subjectIndex) => {
      [0, 1].forEach((weeklyRepeat) => {
        const useLiveSlot =
          sectionRow.course === "BCA" &&
          sectionRow.semester === 1 &&
          sectionRow.section === "A" &&
          subjectIndex === 0 &&
          weeklyRepeat === 0;
        const slotIndex = (subjectIndex + timetableCursor + weeklyRepeat * 2) % TIME_SLOTS.length;
        const [startTime, endTime] = TIME_SLOTS[slotIndex];

        timetableDocs.push({
          classSectionId: sectionRow.doc._id,
          subjectId: subject._id,
          facultyId: subject.facultyId,
          dayOfWeek: useLiveSlot
            ? liveSlot.dayOfWeek
            : DAYS[(subjectIndex + timetableCursor + weeklyRepeat * 3) % DAYS.length],
          startTime: useLiveSlot ? liveSlot.startTime : startTime,
          endTime: useLiveSlot ? liveSlot.endTime : endTime,
          room: `${sectionRow.course}-${sectionRow.semester}${sectionRow.section}-${subjectIndex + 1}`
        });
      });
    });
    timetableCursor += 1;
  }

  const timetables = await Timetable.insertMany(timetableDocs);
  const timetableBySectionSubject = new Map(
    timetables.map((slot) => [`${slot.classSectionId}-${slot.subjectId}`, slot])
  );

  const semesterFees = await SemesterFee.insertMany(
    COURSES.flatMap((course) =>
      SEMESTERS.map((semester) => ({
        title: `${course.code} Semester ${semester} Tuition Fee`,
        course: course.code,
        semester,
        amount: course.feeBase + semester * 2000,
        dueDaysAfterIssue: 30,
        active: true
      }))
    )
  );
  const feeByCourseSemester = new Map(
    semesterFees.map((fee) => [courseSemesterKey(fee.course, fee.semester), fee])
  );

  const invoices = await FeeInvoice.insertMany(
    studentRows.map((row, index) => {
      const fee = feeByCourseSemester.get(courseSemesterKey(row.course, row.semester));
      const status = ["pending", "partially_paid", "paid", "overdue"][index % 4];
      const paidAmount =
        status === "paid" ? fee.amount : status === "partially_paid" ? Math.round(fee.amount * 0.45) : 0;

      return {
        studentId: row.user._id,
        semesterFeeId: fee._id,
        title: fee.title,
        invoiceNumber: `INV-2026-${String(index + 1).padStart(5, "0")}`,
        course: row.course,
        semester: row.semester,
        amount: fee.amount,
        paidAmount,
        dueDate: status === "overdue" ? asDate("2026-04-15") : asDate("2026-05-25"),
        status
      };
    })
  );

  await Payment.insertMany(
    invoices
      .filter((invoice) => invoice.paidAmount > 0)
      .map((invoice, index) => ({
        feeInvoiceId: invoice._id,
        studentId: invoice.studentId,
        amount: invoice.paidAmount,
        paymentDate: asDate(index % 2 === 0 ? "2026-04-20" : "2026-04-25"),
        method: ["upi", "card", "bank", "cash"][index % 4],
        transactionRef: `PAY-2026-${String(index + 1).padStart(5, "0")}`
      }))
  );

  const attendanceDocs = [];
  const marksDocs = [];
  for (const row of studentRows) {
    const sectionSubjects = subjectsByCourseSemester.get(courseSemesterKey(row.course, row.semester));

    sectionSubjects.forEach((subject, subjectIndex) => {
      const numericRoll = Number(String(row.user.rollNumber || "").replace(/\D/g, ""));
      const isLowAttendanceStudent = numericRoll > 0 && numericRoll % 5 === 0;
      const isBorderlineAttendanceStudent = numericRoll > 0 && numericRoll % 7 === 0;

      marksDocs.push({
        studentId: row.user._id,
        subjectId: subject._id,
        subject: subject.name,
        marks: 52 + ((row.user.name.length * 3 + subjectIndex * 13) % 47),
        teacherId: subject.facultyId
      });

      ["2026-04-22", "2026-04-24", "2026-04-27"].forEach((date, dateIndex) => {
        const dateValue = asDate(date);
        const timetable = timetableBySectionSubject.get(`${row.classSection._id}-${subject._id}`);
        const status = isLowAttendanceStudent
          ? subjectIndex < 4 || dateIndex < 2
            ? "absent"
            : "present"
          : isBorderlineAttendanceStudent
            ? subjectIndex < 2 && dateIndex < 2
              ? "absent"
              : "present"
            : (row.user.name.length + subjectIndex + dateIndex) % 8 === 0
              ? "absent"
              : "present";

        attendanceDocs.push({
          studentId: row.user._id,
          subjectId: subject._id,
          timetableId: timetable?._id,
          classSectionId: row.classSection._id,
          dateKey: todayDateKey(dateValue),
          subject: subject.name,
          status,
          teacherId: subject.facultyId,
          date: dateValue
        });
      });
    });
  }
  await Attendance.insertMany(attendanceDocs);
  await Marks.insertMany(marksDocs);

  const assignments = await Assignment.insertMany(
    [...sectionByKey.values()].map((sectionRow, index) => {
      const subject = subjectsByCourseSemester.get(courseSemesterKey(sectionRow.course, sectionRow.semester))[0];
      return {
        title: `${sectionRow.name} Practice Assignment`,
        description: `Complete the practice questions for ${subject.name}.`,
        subjectId: subject._id,
        facultyId: subject.facultyId,
        classSectionId: sectionRow.doc._id,
        dueDate: asDate(index % 2 === 0 ? "2026-05-05" : "2026-05-12"),
        attachmentUrl: ""
      };
    })
  );

  const submissionDocs = [];
  assignments.forEach((assignment) => {
    const sectionStudents = studentRows.filter(
      (row) => String(row.classSection._id) === String(assignment.classSectionId)
    );
    sectionStudents.slice(0, 3).forEach((row, index) => {
      submissionDocs.push({
        assignmentId: assignment._id,
        studentId: row.user._id,
        content: `Submitted sample work by ${row.user.name}.`,
        submittedAt: asDate("2026-04-28"),
        grade: 70 + index * 6,
        feedback: index === 2 ? "Good attempt, add more explanation." : "Checked."
      });
    });
  });
  await Submission.insertMany(submissionDocs);

  const exams = await Exam.insertMany(
    [...sectionByKey.values()].map((sectionRow, index) => {
      const subject = subjectsByCourseSemester.get(courseSemesterKey(sectionRow.course, sectionRow.semester))[1];
      return {
        name: `${sectionRow.name} Unit Test`,
        subjectId: subject._id,
        classSectionId: sectionRow.doc._id,
        examDate: asDate(index % 2 === 0 ? "2026-05-15" : "2026-05-18"),
        totalMarks: 50,
        type: "quiz"
      };
    })
  );

  const gradeDocs = [];
  exams.forEach((exam) => {
    const sectionStudents = studentRows.filter(
      (row) => String(row.classSection._id) === String(exam.classSectionId)
    );
    sectionStudents.forEach((row, index) => {
      gradeDocs.push({
        examId: exam._id,
        studentId: row.user._id,
        marksObtained: 28 + index * 4,
        remarks: index === 4 ? "Needs revision." : "Satisfactory."
      });
    });
  });
  await Grade.insertMany(gradeDocs);

  await Payroll.insertMany(
    faculty.flatMap((member, index) =>
      ["2026-04", "2026-05"].map((month, monthIndex) => ({
        facultyId: member._id,
        month,
        amount: FACULTY_SEED[index][3],
        status: monthIndex === 0 ? "paid" : "pending",
        paidOn: monthIndex === 0 ? asDate("2026-04-30") : undefined
      }))
    )
  );

  await Notice.insertMany([
    {
      title: "Welcome to Full ERP Demo Data",
      body: "BCA and BSC now have two semesters, two sections per semester, assigned faculty, fees, timetable, and student records.",
      audience: "all",
      createdBy: admin._id
    },
    {
      title: "Fee Payment Reminder",
      body: "Students with pending, partially paid, or overdue invoices should test fee submission from the student dashboard.",
      audience: "students",
      createdBy: admin._id
    },
    {
      title: "Attendance Minimum 75 Percent",
      body: "Faculty and students can use the sample attendance data to test low-attendance workflows and notices.",
      audience: "students",
      createdBy: admin._id
    },
    {
      title: "Faculty Session Testing",
      body: "Faculty can check assigned classes, start sessions, and review attendance from their dashboard.",
      audience: "faculty",
      createdBy: admin._id
    },
    {
      title: "BCA Sem 1-A Face Attendance Test",
      body: "This class has a live timetable slot near the current time for easier face attendance testing.",
      audience: "class",
      classSectionId: sectionByKey.get("BCA-S1-A").doc._id,
      createdBy: admin._id
    }
  ]);

  const messageDocs = [
    {
      fromUserId: admin._id,
      content: "Full test dataset loaded. Use seeded credentials to test all dashboards.",
      isBroadcast: true
    }
  ];

  [...sectionByKey.values()].forEach((sectionRow) => {
    const subject = subjectsByCourseSemester.get(courseSemesterKey(sectionRow.course, sectionRow.semester))[0];
    messageDocs.push({
      fromUserId: subject.facultyId,
      classSectionId: sectionRow.doc._id,
      content: `${sectionRow.name}: Please check timetable, assignments, fees, and attendance records.`,
      isBroadcast: true
    });
  });

  students.slice(0, 8).forEach((student, index) => {
    messageDocs.push({
      fromUserId: admin._id,
      toUserId: student._id,
      content: index % 2 === 0 ? "Your attendance needs regular monitoring." : "Please verify your fee invoice.",
      isBroadcast: false
    });
  });
  await Message.insertMany(messageDocs);

  await AdmissionApplication.insertMany([
    {
      applicantName: "Tanya Kapoor",
      email: "tanya.kapoor@example.com",
      phone: "9999900011",
      desiredDepartmentId: departmentByCode.get("BCA")._id,
      status: "new",
      notes: "Interested in BCA admission."
    },
    {
      applicantName: "Mohit Saxena",
      email: "mohit.saxena@example.com",
      phone: "9999900012",
      desiredDepartmentId: departmentByCode.get("BSC")._id,
      status: "reviewed",
      notes: "Documents verified."
    },
    {
      applicantName: "Sara Fernandes",
      email: "sara.fernandes@example.com",
      phone: "9999900013",
      desiredDepartmentId: departmentByCode.get("BCA")._id,
      status: "accepted",
      notes: "Accepted for counselling round."
    },
    {
      applicantName: "Adil Khan",
      email: "adil.khan@example.com",
      phone: "9999900014",
      desiredDepartmentId: departmentByCode.get("BSC")._id,
      status: "rejected",
      notes: "Incomplete documents."
    }
  ]);

  const counts = {
    admins: 1,
    faculty: faculty.length,
    students: students.length,
    departments: departments.length,
    semesters: semesters.length,
    classSections: classSections.length,
    subjects: subjects.length,
    timetableSlots: timetables.length,
    feePlans: semesterFees.length,
    invoices: invoices.length,
    payments: invoices.filter((invoice) => invoice.paidAmount > 0).length,
    attendanceRecords: attendanceDocs.length,
    marks: marksDocs.length,
    assignments: assignments.length,
    submissions: submissionDocs.length,
    exams: exams.length,
    grades: gradeDocs.length,
    notices: 5,
    messages: messageDocs.length
  };

  console.log("Full BCA/BSC sample data inserted successfully.");
  console.table(counts);
  console.log("\nLogin credentials:");
  console.log(`Admin:   admin@edunexus.com / ${PASSWORDS.admin}`);
  console.log(`Faculty: priya.sharma@edunexus.com / ${PASSWORDS.faculty}`);
  console.log(`Student: aarav.sharma.bcas1a.01@edunexus.com / ${PASSWORDS.student}`);
  console.log("\nEvery faculty uses faculty123. Every student uses student123 unless env overrides were used.");
  console.log("Face enrollment data was cleared. Re-enroll faces before testing face attendance.");

  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors during failure cleanup.
  }
  process.exit(1);
});
