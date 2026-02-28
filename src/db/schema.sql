CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS question_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id TEXT,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(module_id) REFERENCES modules(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER,
  module_id TEXT,
  content TEXT NOT NULL,
  answer TEXT,
  difficulty TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(batch_id) REFERENCES question_batches(id) ON DELETE CASCADE,
  FOREIGN KEY(module_id) REFERENCES modules(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id TEXT,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  transcript_text TEXT
);

CREATE TABLE IF NOT EXISTS interview_practices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  transcript_text TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(batch_id) REFERENCES question_batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO modules (id, name, description) VALUES 
('full_simulation', 'Full Simulation', 'Simulates a real interview environment'),
('knowledge', 'Knowledge Module', 'Focuses on technical knowledge and concepts'),
('project', 'Project Module', 'Deep dive into your project experience'),
('scenario', 'Scenario Module', 'Situational and behavioral questions');

CREATE TABLE IF NOT EXISTS batch_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(parent_id) REFERENCES batch_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batch_category_assignments (
  batch_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY(batch_id, category_id),
  FOREIGN KEY(batch_id) REFERENCES question_batches(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES batch_categories(id) ON DELETE CASCADE
);
