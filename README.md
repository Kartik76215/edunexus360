# EduNexus360

EduNexus360 is a full-stack academic management system for colleges and institutes. It provides role-based dashboards for administrators, faculty, and students with modules for users, courses, class sections, subjects, attendance, marks, fees, notices, events, workshops, assignments, timetable management, and face-attendance support.

## Features

- Admin dashboard for managing students, faculty, courses, semesters, sections, subjects, fees, notices, events, and workshops
- Student dashboard for attendance, marks, assignments, fees, communication, and face attendance
- Faculty dashboard for class-wise attendance, marks entry, assignments, messages, and timetable views
- Course and section based student organization
- Event/workshop communication with image upload support
- Face enrollment and face attendance workflow
- MongoDB-backed REST API
- React + Vite frontend

## Tech Stack

- Frontend: React, Vite, Axios
- Backend: Node.js, Express.js, Mongoose
- Database: MongoDB
- Face engine: Python service support

## Project Structure

```text
edunexus360/
  backend/     Express API, MongoDB models, routes, scripts
  frontend/    React Vite application
  docs/        Database/schema notes
```

## Setup

### Backend

```bash
cd backend
npm install
npm start
```

By default, the backend connects to:

```text
mongodb://127.0.0.1:27017/edunexus360
```

You can override it using:

```bash
MONGO_URI=your_mongodb_connection_string
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend uses:

```text
http://localhost:5000/api
```

as the default backend API URL. You can override it with:

```bash
VITE_API_BASE_URL=your_backend_api_url
```

## Data Scripts

Clear all local app data:

```bash
cd backend
npm run clear:data
```

Seed sample data:

```bash
cd backend
npm run seed:reset
```

If known seed login passwords are needed, set these environment variables before running the seed script:

```bash
SEED_ADMIN_PASSWORD=your_admin_password
SEED_FACULTY_PASSWORD=your_faculty_password
SEED_STUDENT_PASSWORD=your_student_password
```

## Privacy Note

This repository does not include local database data, exported login files, logs, build output, `node_modules`, or environment files. Add your own `.env` values locally when running or deploying the project.
