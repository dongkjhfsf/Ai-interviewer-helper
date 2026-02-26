CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id TEXT,
  content TEXT NOT NULL,
  difficulty TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(module_id) REFERENCES modules(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id TEXT,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  transcript_text TEXT
);

INSERT OR IGNORE INTO modules (id, name, description) VALUES 
('full_simulation', 'Full Simulation', 'Simulates a real interview environment'),
('knowledge', 'Knowledge Module', 'Focuses on technical knowledge and concepts'),
('project', 'Project Module', 'Deep dive into your project experience'),
('scenario', 'Scenario Module', 'Situational and behavioral questions');
