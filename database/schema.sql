-- Initial PostgreSQL schema for OKPT Schedule.
-- No production or personal data is included in this repository.

CREATE TABLE departments (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE specialties (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  department_id BIGINT REFERENCES departments(id),
  UNIQUE (code, department_id)
);

CREATE TABLE student_groups (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  specialty_id BIGINT REFERENCES specialties(id),
  course_no SMALLINT,
  study_form TEXT,
  source_document TEXT NOT NULL DEFAULT 'расписание 13 недели.pdf',
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('extracted','needs_review','approved','rejected'))
);

CREATE TABLE teachers (
  id BIGSERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  position_title TEXT,
  employment_type TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('extracted','needs_review','approved','rejected'))
);

CREATE TABLE disciplines (
  id BIGSERIAL PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  discipline_type TEXT
);

CREATE TABLE curricula (
  id BIGSERIAL PRIMARY KEY,
  specialty_id BIGINT NOT NULL REFERENCES specialties(id),
  academic_year TEXT NOT NULL,
  source_document TEXT NOT NULL,
  source_version TEXT,
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('extracted','needs_review','approved','rejected'))
);

CREATE TABLE curriculum_items (
  id BIGSERIAL PRIMARY KEY,
  curriculum_id BIGINT NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  discipline_id BIGINT NOT NULL REFERENCES disciplines(id),
  semester_no SMALLINT,
  total_academic_hours NUMERIC(7,2),
  classroom_hours NUMERIC(7,2),
  independent_hours NUMERIC(7,2),
  practice_hours NUMERIC(7,2),
  assessment_type TEXT,
  source_page SMALLINT,
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('extracted','needs_review','approved','rejected'))
);

CREATE TABLE academic_calendar_periods (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES student_groups(id),
  department_id BIGINT REFERENCES departments(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_type TEXT NOT NULL,
  label TEXT,
  source_document TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('extracted','needs_review','approved','rejected')),
  CHECK (end_date >= start_date)
);

CREATE TABLE rooms (
  id BIGSERIAL PRIMARY KEY,
  room_code TEXT UNIQUE NOT NULL,
  building TEXT,
  capacity INTEGER,
  room_type TEXT,
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_activity_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE bell_slots (
  id BIGSERIAL PRIMARY KEY,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  monday_variant TEXT,
  lesson_no SMALLINT NOT NULL,
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  slot_kind TEXT NOT NULL DEFAULT 'lesson',
  CHECK (ends_at > starts_at)
);

CREATE TABLE teacher_availability (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  valid_from DATE,
  valid_to DATE,
  availability_type TEXT NOT NULL DEFAULT 'available',
  CHECK (ends_at > starts_at)
);

CREATE TABLE teaching_assignments (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id),
  group_id BIGINT NOT NULL REFERENCES student_groups(id),
  discipline_id BIGINT NOT NULL REFERENCES disciplines(id),
  subgroup_code TEXT,
  planned_academic_hours NUMERIC(7,2),
  valid_from DATE,
  valid_to DATE,
  source_document TEXT,
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('extracted','needs_review','approved','rejected'))
);

CREATE TABLE scheduled_sessions (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT REFERENCES teaching_assignments(id),
  group_id BIGINT NOT NULL REFERENCES student_groups(id),
  teacher_id BIGINT NOT NULL REFERENCES teachers(id),
  discipline_id BIGINT NOT NULL REFERENCES disciplines(id),
  room_id BIGINT REFERENCES rooms(id),
  session_date DATE NOT NULL,
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  subgroup_code TEXT,
  session_type TEXT NOT NULL DEFAULT 'lesson',
  source TEXT NOT NULL DEFAULT 'generated',
  status TEXT NOT NULL DEFAULT 'draft',
  CHECK (ends_at > starts_at)
);

CREATE TABLE replacements (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES scheduled_sessions(id),
  original_teacher_id BIGINT NOT NULL REFERENCES teachers(id),
  substitute_teacher_id BIGINT NOT NULL REFERENCES teachers(id),
  reason TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE replacement_audit (
  id BIGSERIAL PRIMARY KEY,
  replacement_id BIGINT NOT NULL REFERENCES replacements(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_date_time ON scheduled_sessions(session_date, starts_at, ends_at);
CREATE INDEX idx_sessions_teacher ON scheduled_sessions(teacher_id, session_date);
CREATE INDEX idx_sessions_group ON scheduled_sessions(group_id, session_date);
CREATE INDEX idx_calendar_dates ON academic_calendar_periods(start_date, end_date);
