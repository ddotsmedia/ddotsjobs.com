-- 0029_skill_assessments — quizzes, attempts, badges. Static questions (no AI).
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  icon VARCHAR(16),
  passing_score INTEGER NOT NULL DEFAULT 70,
  total_questions INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  explanation TEXT,
  UNIQUE (assessment_id, question_number)
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers_json JSONB NOT NULL DEFAULT '{}',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON assessment_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON assessment_attempts (assessment_id);
CREATE INDEX IF NOT EXISTS idx_attempts_passed ON assessment_attempts (passed);
CREATE INDEX IF NOT EXISTS idx_attempts_attempted ON assessment_attempts (attempted_at DESC);

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, assessment_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges (user_id);

-- Seed 5 assessments.
INSERT INTO assessments (slug, title, description, icon, passing_score, total_questions) VALUES
  ('react', 'React', 'Core React concepts: components, hooks, state.', '⚛️', 70, 5),
  ('nodejs', 'Node.js', 'Node.js runtime, modules, async basics.', '🟢', 70, 5),
  ('kotlin', 'Kotlin', 'Kotlin language fundamentals.', '🟣', 70, 5),
  ('postgresql', 'PostgreSQL', 'SQL and PostgreSQL essentials.', '🐘', 70, 5),
  ('typescript', 'TypeScript', 'TypeScript types and features.', '🔷', 70, 5)
ON CONFLICT (slug) DO NOTHING;

-- Seed questions per assessment (idempotent via UNIQUE(assessment_id, question_number)).
INSERT INTO assessment_questions (assessment_id, question_number, question_text, correct_answer, option_a, option_b, option_c, option_d, explanation)
SELECT a.id, q.n, q.qt, q.ca, q.oa, q.ob, q.oc, q.od, q.ex
FROM assessments a
JOIN (VALUES
  -- React
  ('react',1,'Which hook adds state to a function component?','B','useEffect','useState','useRef','useMemo','useState manages local state.'),
  ('react',2,'What does the dependency array in useEffect control?','C','Styling','Rendering order','When the effect re-runs','Component name','Effect re-runs when a dependency changes.'),
  ('react',3,'What must every item in a list have?','A','A unique key prop','An id state','A ref','A context','Keys help React identify changed items.'),
  ('react',4,'JSX is compiled to calls of…','D','React.render','React.dom','React.node','React.createElement','JSX becomes React.createElement calls.'),
  ('react',5,'Which prevents unnecessary re-renders of a component?','B','useState','React.memo','useEffect','useId','React.memo memoizes a component.'),
  -- Node.js
  ('nodejs',1,'Node.js is built on which JS engine?','A','V8','SpiderMonkey','Chakra','JavaScriptCore','Node uses Chrome''s V8 engine.'),
  ('nodejs',2,'Which module handles file system access?','C','http','path','fs','os','The fs module reads/writes files.'),
  ('nodejs',3,'What does module.exports do?','B','Imports a module','Exposes values from a module','Deletes a module','Runs a script','module.exports defines a module''s public API.'),
  ('nodejs',4,'The event loop enables Node to be…','D','Multi-threaded by default','Synchronous','Blocking','Non-blocking / async','The event loop enables non-blocking I/O.'),
  ('nodejs',5,'Which command installs dependencies?','A','npm install','npm run','node start','npm build','npm install reads package.json.'),
  -- Kotlin
  ('kotlin',1,'Which keyword declares an immutable variable?','B','var','val','let','const','val is read-only; var is mutable.'),
  ('kotlin',2,'What denotes a nullable type?','C','!','&','?','#','A trailing ? marks a nullable type, e.g. String?.'),
  ('kotlin',3,'Kotlin primarily targets which platform?','A','JVM','.NET','Ruby VM','BEAM','Kotlin compiles to JVM bytecode (also JS/native).'),
  ('kotlin',4,'Which builds a function?','D','def','func','sub','fun','Functions use the fun keyword.'),
  ('kotlin',5,'The Elvis operator ?: is used to…','B','Cast types','Provide a default for null','Loop','Concatenate','a ?: b returns b when a is null.'),
  -- PostgreSQL
  ('postgresql',1,'Which statement reads rows?','A','SELECT','INSERT','UPDATE','DELETE','SELECT queries data.'),
  ('postgresql',2,'Which clause filters rows?','C','ORDER BY','GROUP BY','WHERE','LIMIT','WHERE filters rows by condition.'),
  ('postgresql',3,'A PRIMARY KEY is always…','B','Nullable','Unique and not null','A foreign key','Text','Primary keys are unique and not null.'),
  ('postgresql',4,'Which JOIN keeps all left rows?','D','INNER JOIN','CROSS JOIN','RIGHT JOIN','LEFT JOIN','LEFT JOIN keeps every left row.'),
  ('postgresql',5,'Which type stores structured JSON efficiently?','A','JSONB','TEXT','VARCHAR','BYTEA','JSONB stores binary JSON with indexing.'),
  -- TypeScript
  ('typescript',1,'TypeScript adds what to JavaScript?','B','A new runtime','Static types','A database','A CSS engine','TS adds static typing atop JS.'),
  ('typescript',2,'Which allows any type?','C','never','void','any','unknown','any opts out of type checking.'),
  ('typescript',3,'How do you declare a fixed set of values?','A','enum','class','module','tuple','enum defines named constants.'),
  ('typescript',4,'Which describes an object shape?','D','function','array','number','interface','interface (or type) describes object shape.'),
  ('typescript',5,'What compiles TypeScript to JavaScript?','B','node','tsc','npm','babel-only','tsc is the TypeScript compiler.')
) AS q(slug,n,qt,ca,oa,ob,oc,od,ex) ON q.slug = a.slug
ON CONFLICT (assessment_id, question_number) DO NOTHING;
