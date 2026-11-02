/**
 * Frontend Assets & Single-Page Application (SPA) Integration Tests
 * [Milestone 4 Verification]: Static asset delivery, HTML views, CSS palette, script dependencies,
 *                             SPA fallback routing, and prohibition of non-standard frontend libraries.
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../../src/database/db');
const { seedDatabase } = require('../../src/database/seed');
const { createApp } = require('../../src/app');

describe('Frontend Integration & Static Asset Delivery', () => {
  let db;
  let app;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    await seedDatabase(db);
    app = createApp({ dbClient: db });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Static HTML & View Architecture', () => {
    test('serves index.html at root (GET /) with HTTP 200 and text/html', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('Digital Quiz Portal');
    });

    test('contains all 5 mandatory application view containers', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('id="view-login"');
      expect(res.text).toContain('id="view-admin"');
      expect(res.text).toContain('id="view-student"');
      expect(res.text).toContain('id="view-exam"');
      expect(res.text).toContain('id="view-results"');
    });

    test('contains all required academic examination modals', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('id="modal-create-quiz"');
      expect(res.text).toContain('id="modal-edit-quiz"');
      expect(res.text).toContain('id="modal-questions-manager"');
      expect(res.text).toContain('id="modal-question-form"');
      expect(res.text).toContain('id="modal-submit-exam"');
      expect(res.text).toContain('id="modal-submission-detail"');
    });

    test('loads all modular client scripts in exact dependency order', async () => {
      const res = await request(app).get('/');
      const expectedScripts = [
        '<script src="/js/utils.js"></script>',
        '<script src="/js/api.js"></script>',
        '<script src="/js/auth.js"></script>',
        '<script src="/js/admin.js"></script>',
        '<script src="/js/student.js"></script>',
        '<script src="/js/exam.js"></script>',
        '<script src="/js/results.js"></script>',
        '<script src="/js/app.js"></script>'
      ];

      let lastIndex = -1;
      for (const scriptTag of expectedScripts) {
        const idx = res.text.indexOf(scriptTag);
        expect(idx).toBeGreaterThan(-1);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }
    });
  });

  describe('CSS Stylesheet & Academic Palette Delivery', () => {
    test('serves styles.css with text/css and approved academic color variables', async () => {
      const res = await request(app).get('/css/styles.css');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/css/);

      // Verify approved academic palette values
      expect(res.text).toContain('#F7F6F2'); // Ivory background
      expect(res.text).toContain('#242621'); // Charcoal primary text
      expect(res.text).toContain('#345647'); // Forest green primary action
      expect(res.text).toContain('#A0A58A'); // Muted olive secondary accent
      expect(res.text).toContain('#E7E5DE'); // Warm grey borders
      expect(res.text).toContain('#FFFFFF'); // Pure white surfaces
    });
  });

  describe('Modular Client JavaScript Asset Delivery', () => {
    const scripts = [
      'utils.js',
      'api.js',
      'auth.js',
      'admin.js',
      'student.js',
      'exam.js',
      'results.js',
      'app.js'
    ];

    test.each(scripts)('serves /js/%s successfully with HTTP 200', async (scriptName) => {
      const res = await request(app).get(`/js/${scriptName}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/javascript/);
      expect(res.text.length).toBeGreaterThan(100);
    });
  });

  describe('SPA Fallback Routing vs API 404 Handling', () => {
    test('falls back to index.html for non-API client routes (GET /exam-session)', async () => {
      const res = await request(app).get('/exam-session');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Digital Quiz Portal');
    });

    test('returns structured JSON 404 for undefined /api routes', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error).toContain('Route not found');
    });
  });

  describe('Student Submission History API (/api/attempts/history)', () => {
    test('strictly enforces authentication on student submission history', async () => {
      const res = await request(app).get('/api/attempts/history');
      expect(res.status).toBe(401);
    });

    test('returns submission history for authenticated student', async () => {
      // Login as student1
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'student1', password: 'student123' });
      const token = loginRes.body.token;

      const historyRes = await request(app)
        .get('/api/attempts/history')
        .set('Authorization', `Bearer ${token}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(Array.isArray(historyRes.body.history)).toBe(true);
      // Student 1 has initial seeded submission from STQA Report Results Page 8
      expect(historyRes.body.history.length).toBeGreaterThanOrEqual(1);
      const sub = historyRes.body.history[0];
      expect(sub.quiz_title).toBeDefined();
      expect(sub.score).toBeDefined();
      expect(sub.total_questions).toBeDefined();
      expect(sub.percentage).toBeDefined();
      expect(sub.status).toBeDefined();
    });
  });

  describe('Prohibition of Unauthorized Libraries & Frameworks', () => {
    test('package.json contains only approved backend libraries (no React, Vue, Angular, Bootstrap, Tailwind)', () => {
      const pkgPath = path.join(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {})
      };

      const forbidden = ['react', 'vue', 'angular', 'bootstrap', 'tailwindcss', 'jquery', 'next', 'nuxt'];
      for (const banned of forbidden) {
        expect(allDeps[banned]).toBeUndefined();
      }
    });

    test('index.html contains no external CDN references or frameworks', async () => {
      const res = await request(app).get('/');
      expect(res.text).not.toContain('cdn.jsdelivr.net');
      expect(res.text).not.toContain('cdnjs.cloudflare.com');
      expect(res.text).not.toContain('unpkg.com');
      expect(res.text).not.toContain('bootstrap');
      expect(res.text).not.toContain('tailwind');
    });
  });
});

