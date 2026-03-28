import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Health & System', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/test-db returns database status', async () => {
    const res = await request(app).get('/api/test-db');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toContain('Database connected');
  });

  it('GET /api/docs returns Swagger UI', async () => {
    const res = await request(app).get('/api/docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });

  it('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('Auth & RBAC (unauthenticated)', () => {
  it('GET /api/vehicles returns 401 without token', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Authorization');
  });

  it('GET /api/reservations returns 401 without token', async () => {
    const res = await request(app).get('/api/reservations');
    expect(res.status).toBe(401);
  });

  it('GET /api/transactions returns 401 without token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications returns 401 without token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('GET /api/documents returns 401 without token', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('GET /api/maintenance returns 401 without token', async () => {
    const res = await request(app).get('/api/maintenance');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/overview returns 401 without token', async () => {
    const res = await request(app).get('/api/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('POST /api/users returns 401 without token', async () => {
    const res = await request(app).post('/api/users').send({ email: 'a@b.com', password: '123456', firstName: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/vehicles')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});

describe('Validation middleware', () => {
  // These tests use a valid-looking but expired/fake token — they'll hit 401 before validation.
  // We test validation logic by checking the schema parsing directly.

  it('vehicle query schema accepts valid params', async () => {
    const { vehicleQuerySchema } = await import('../schemas/vehicles');
    const result = vehicleQuerySchema.safeParse({ status: 'available', page: '2', limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('available');
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
    }
  });

  it('vehicle query schema rejects invalid status', async () => {
    const { vehicleQuerySchema } = await import('../schemas/vehicles');
    const result = vehicleQuerySchema.safeParse({ status: 'broken' });
    expect(result.success).toBe(false);
  });

  it('createVehicleSchema requires model, brand, plate_number', async () => {
    const { createVehicleSchema } = await import('../schemas/vehicles');
    const result = createVehicleSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map(i => i.path[0]);
      expect(fields).toContain('model');
      expect(fields).toContain('brand');
      expect(fields).toContain('plate_number');
    }
  });

  it('createVehicleSchema rejects invalid transmission enum', async () => {
    const { createVehicleSchema } = await import('../schemas/vehicles');
    const result = createVehicleSchema.safeParse({
      model: 'X', brand: 'Y', plate_number: 'Z', transmission: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('createUserSchema requires email, password, firstName', async () => {
    const { createUserSchema } = await import('../schemas/users');
    const result = createUserSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map(i => i.path[0]);
      expect(fields).toContain('email');
      expect(fields).toContain('password');
      expect(fields).toContain('firstName');
    }
  });

  it('createUserSchema rejects invalid email', async () => {
    const { createUserSchema } = await import('../schemas/users');
    const result = createUserSchema.safeParse({ email: 'bad', password: '123456', firstName: 'X' });
    expect(result.success).toBe(false);
  });

  it('createUserSchema rejects short password', async () => {
    const { createUserSchema } = await import('../schemas/users');
    const result = createUserSchema.safeParse({ email: 'a@b.com', password: 'ab', firstName: 'X' });
    expect(result.success).toBe(false);
  });

  it('transitionStatusSchema rejects invalid status', async () => {
    const { transitionStatusSchema } = await import('../schemas/reservations');
    const result = transitionStatusSchema.safeParse({ new_status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('transitionStatusSchema accepts valid status', async () => {
    const { transitionStatusSchema } = await import('../schemas/reservations');
    const result = transitionStatusSchema.safeParse({ new_status: 'active' });
    expect(result.success).toBe(true);
  });

  it('recordPaymentSchema requires positive amount', async () => {
    const { recordPaymentSchema } = await import('../schemas/reservations');
    const result = recordPaymentSchema.safeParse({});
    expect(result.success).toBe(false);
    const result2 = recordPaymentSchema.safeParse({ amount: -5 });
    expect(result2.success).toBe(false);
    const result3 = recordPaymentSchema.safeParse({ amount: 500 });
    expect(result3.success).toBe(true);
  });

  it('createMaintenanceSchema requires car_id, schedule_date, service_type', async () => {
    const { createMaintenanceSchema } = await import('../schemas/maintenance');
    const result = createMaintenanceSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map(i => i.path[0]);
      expect(fields).toContain('car_id');
      expect(fields).toContain('schedule_date');
      expect(fields).toContain('service_type');
    }
  });

  it('createDocumentSchema requires user_id, document_type, image_url', async () => {
    const { createDocumentSchema } = await import('../schemas/documents');
    const result = createDocumentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('notificationQuerySchema coerces is_read boolean', async () => {
    const { notificationQuerySchema } = await import('../schemas/notifications');
    const result = notificationQuerySchema.safeParse({ is_read: 'true', page: '1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_read).toBe(true);
    }
  });

  it('reservationQuerySchema accepts valid filters', async () => {
    const { reservationQuerySchema } = await import('../schemas/reservations');
    const result = reservationQuerySchema.safeParse({ status: 'pending', page: '1', limit: '10' });
    expect(result.success).toBe(true);
  });
});
