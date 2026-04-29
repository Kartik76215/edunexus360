-- Face Recognition Attendance Extension (SQL reference schema)
-- This SQL schema is provided as a relational reference model.
-- The current ERP implementation uses MongoDB models with equivalent fields/constraints.

CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL
);

CREATE TABLE face_data (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
  embedding_vector JSON NOT NULL,
  sample_count INT NOT NULL,
  vector_length INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE timetable (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  class_section_id BIGINT NOT NULL,
  subject VARCHAR(150) NOT NULL,
  faculty_id BIGINT NOT NULL REFERENCES users(id),
  day VARCHAR(3) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_session (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  class_id BIGINT NOT NULL REFERENCES timetable(id),
  faculty_id BIGINT NOT NULL REFERENCES users(id),
  session_date DATE NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  source VARCHAR(10) NOT NULL CHECK (source IN ('auto', 'manual')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_id BIGINT NOT NULL REFERENCES users(id),
  class_id BIGINT NOT NULL REFERENCES timetable(id),
  session_id BIGINT NOT NULL REFERENCES attendance_session(id),
  attendance_date DATE NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(10) NOT NULL DEFAULT 'present',
  match_score NUMERIC(6,4) NOT NULL,
  match_distance NUMERIC(8,6) NOT NULL,
  liveness_blink_count INT NOT NULL,
  liveness_head_turn_angle NUMERIC(6,2) NOT NULL,
  ip_address VARCHAR(64),
  CONSTRAINT one_attendance_per_class_per_day UNIQUE (student_id, class_id, attendance_date)
);
