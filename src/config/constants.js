/**
 * System-Wide Constants for Digital Quiz Portal
 * [Category A]: Report-mandated values (Pass threshold = 50.0%, Roles)
 * [Category B]: Necessary implementation assumptions (Duration = 10m, Grace = 30s)
 * [Category C]: Security configurations (scrypt parameters, salt length, session TTL)
 */

const path = require('path');

module.exports = {
  // Roles [Category A - STQA §2, OOMD Diagram 1, 2]
  ROLES: {
    ADMIN: 'admin',
    STUDENT: 'student'
  },

  // Scoring Thresholds [Category A - STQA §1]
  PASS_THRESHOLD_PERCENT: 50.0,

  // Examination Timing Assumptions [Category B - Implementation Assumptions]
  DEFAULT_QUIZ_DURATION_MINUTES: 10,
  GRACE_PERIOD_SECONDS: 30,

  // Attempt & Submission Statuses [Category B - Lifecycle Management]
  ATTEMPT_STATUS: {
    IN_PROGRESS: 'IN_PROGRESS',
    PASSED: 'PASSED',
    FAILED: 'FAILED'
  },

  // Session Management [Category C - In-Memory Session Security]
  SESSION: {
    DEFAULT_TTL_MS: 24 * 60 * 60 * 1000 // 24 hours
  },

  // Cryptographic Configuration [Category C - Asynchronous Security]
  CRYPTO: {
    SALT_BYTE_LENGTH: 16,
    KEY_BYTE_LENGTH: 64,
    SCRYPT_OPTIONS: {
      N: 16384, // CPU/memory cost parameter (standard scrypt)
      r: 8,     // block size parameter
      p: 1      // parallelization parameter
    }
  },

  // Storage Paths [Category A - STQA §3 Program]
  DEFAULT_DB_PATH: path.resolve(__dirname, '../../database.sqlite')
};
