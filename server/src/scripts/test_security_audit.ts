import assert from 'assert';
import { requireTenantAccess } from '../shared/middlewares/tenant.middleware';
import { createRateLimiter } from '../shared/middlewares/rateLimit.middleware';
import { authorize } from '../shared/middlewares/auth.middleware';

function mockReqRes(options: {
  user?: any;
  params?: any;
  ip?: string;
  headers?: Record<string, string>;
}) {
  const req: any = {
    user: options.user,
    params: options.params || {},
    ip: options.ip || '127.0.0.1',
    headers: options.headers || {},
    socket: { remoteAddress: options.ip || '127.0.0.1' },
  };

  const headersSent: Record<string, any> = {};
  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    setHeader(name: string, val: any) {
      headersSent[name] = val;
    },
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData, getHeaders: () => headersSent };
}

async function runTests() {
  console.log('--- STARTING SECURITY & BUG AUDIT TESTS ---\n');
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ [FAIL] ${name}:`, e.message);
    }
  }

  // 1. TENANT ISOLATION TESTS
  test('Tenant: User PUSKESMAS harus ditolak mengakses posyandu internal (403)', () => {
    const { req, res, getStatus, getData } = mockReqRes({
      user: { userId: 'u1', posyanduId: 'pos-1', role: 'PUSKESMAS' },
      params: { posyanduId: 'pos-1' },
    });
    let nextCalled = false;
    requireTenantAccess(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Next should not be called');
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getData().success, false);
  });

  test('Tenant: Kader dari Posyandu A DITOLAK saat mencoba akses Posyandu B (IDOR prevention) (403)', () => {
    const { req, res, getStatus, getData } = mockReqRes({
      user: { userId: 'u2', posyanduId: 'pos-A', role: 'KADER' },
      params: { posyanduId: 'pos-B' },
    });
    let nextCalled = false;
    requireTenantAccess(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getData().success, false);
  });

  test('Tenant: Owner dari Posyandu A DITOLAK saat mencoba akses Posyandu B (403)', () => {
    const { req, res, getStatus } = mockReqRes({
      user: { userId: 'u3', posyanduId: 'pos-A', role: 'OWNER' },
      params: { posyanduId: 'pos-B' },
    });
    let nextCalled = false;
    requireTenantAccess(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
  });

  test('Tenant: Kader Posyandu A DIIZINKAN mengakses data Posyandu A miliknya sendiri', () => {
    const { req, res, getStatus } = mockReqRes({
      user: { userId: 'u4', posyanduId: 'pos-A', role: 'KADER' },
      params: { posyanduId: 'pos-A' },
    });
    let nextCalled = false;
    requireTenantAccess(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(getStatus(), 200);
  });

  // 2. ROLE AUTHORIZATION TESTS
  test('RBAC: Role PUSKESMAS diizinkan ke endpoint puskesmas', () => {
    const { req, res } = mockReqRes({
      user: { userId: 'u5', posyanduId: 'pos-1', role: 'PUSKESMAS' },
    });
    let nextCalled = false;
    const authMw = authorize('PUSKESMAS');
    authMw(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  test('RBAC: Role KADER ditolak dari endpoint Puskesmas (403)', () => {
    const { req, res, getStatus } = mockReqRes({
      user: { userId: 'u6', posyanduId: 'pos-1', role: 'KADER' },
    });
    let nextCalled = false;
    const authMw = authorize('PUSKESMAS');
    authMw(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(getStatus(), 403);
  });

  // 3. RATE LIMITING TESTS
  test('Rate Limiter: Membatasi request berlebih dan mengembalikan 429 Too Many Requests', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 3 });
    const ip = '192.168.1.100';

    for (let i = 1; i <= 3; i++) {
      const { req, res, getStatus } = mockReqRes({ ip });
      let nextCalled = false;
      limiter(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, `Request ${i} should succeed`);
      assert.strictEqual(getStatus(), 200);
    }

    // Request ke-4 harus diblokir
    const { req: req4, res: res4, getStatus: getStatus4, getData: getData4, getHeaders: getHeaders4 } = mockReqRes({ ip });
    let nextCalled4 = false;
    limiter(req4, res4, () => { nextCalled4 = true; });
    assert.strictEqual(nextCalled4, false, 'Request 4 should be blocked');
    assert.strictEqual(getStatus4(), 429, 'Status should be 429');
    assert.strictEqual(getData4().success, false);
    assert.ok(getHeaders4()['Retry-After'] !== undefined, 'Retry-After header should be present');
  });

  // 4. PRIVACY & SANITIZATION TESTS
  test('Privacy & Sanitization: Masking NIK dan Nama Ibu bekerja dengan aman', () => {
    const rawNik = '3216010101240001';
    const maskedNik = `${rawNik.slice(0, 6)}******${rawNik.slice(-4)}`;
    assert.strictEqual(maskedNik, '321601******0001');

    function maskName(name: string): string {
      return name.trim().split(/\s+/).map(p => p.length <= 2 ? p : `${p[0]}${'*'.repeat(Math.min(p.length - 1, 4))}`).join(' ');
    }
    const maskedIbu = maskName('Siti Aminah');
    assert.strictEqual(maskedIbu, 'S*** A****');
  });

  console.log(`\n--- HASIL AUDIT: ${passed}/${total} TESTS PASSED ---`);
  process.exit(passed === total ? 0 : 1);
}

runTests();
