/**
 * 013_autopilot_pending_questions.js
 *
 * Crea la tabla que usa autopilot-question-db.js. Sin ella, el cleanup
 * cada 10 min (expireOldQuestions) falla con "relation does not exist"
 * y ensucia los logs del health check.
 *
 * Esquema idéntico a createPendingQuestionsTable() en autopilot-question-db.js.
 */

export const name = '013_autopilot_pending_questions';

export async function up(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS autopilot_pending_questions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      question_type VARCHAR(100) NOT NULL,
      question_text TEXT NOT NULL,
      question_data JSONB DEFAULT '{}',
      asked_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      answer TEXT,
      answer_result JSONB,
      answered_at TIMESTAMP,
      expired_at TIMESTAMP
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_pending_questions_user_status
    ON autopilot_pending_questions(user_id, status)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_pending_questions_expires
    ON autopilot_pending_questions(expires_at)
    WHERE status = 'pending'
  `);
}

export async function down(db) {
  await db.run(`DROP TABLE IF EXISTS autopilot_pending_questions`);
}
