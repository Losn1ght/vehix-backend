import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vehix API',
      version: '1.0.0',
      description: 'Car Rental Booking & Fleet Management API for Queen Rent A Car Cebu',
    },
    servers: [
      { url: '/api', description: 'API server' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        Vehicle: {
          type: 'object',
          properties: {
            car_id: { type: 'string', format: 'uuid' },
            model: { type: 'string' },
            brand: { type: 'string' },
            year: { type: 'integer' },
            plate_number: { type: 'string' },
            capacity: { type: 'integer' },
            transmission: { type: 'string', enum: ['manual', 'automatic'] },
            fuel_type: { type: 'string', enum: ['gasoline', 'diesel', 'electric', 'hybrid'] },
            rate_per_day: { type: 'number' },
            status: { type: 'string', enum: ['available', 'unavailable', 'maintenance'] },
            current_mileage: { type: 'integer' },
            image: { type: 'string' },
            type: { type: 'string' },
          },
        },
        Reservation: {
          type: 'object',
          properties: {
            reservation_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            car_id: { type: 'string', format: 'uuid' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            rental_price: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'active', 'completed', 'cancelled', 'rejected'] },
            pickup_location: { type: 'string' },
            reservation_fee: { type: 'number' },
            is_reservation_fee_paid: { type: 'boolean' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            transaction_id: { type: 'string', format: 'uuid' },
            reservation_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            payment_method: { type: 'string', enum: ['cash', 'gcash', 'bpi', 'bank_transfer'] },
            payment_status: { type: 'string', enum: ['completed', 'pending', 'failed', 'refunded'] },
            reference_number: { type: 'string' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            notif_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            content: { type: 'string' },
            is_read: { type: 'boolean' },
            target_role: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            document_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            document_type: { type: 'string' },
            image_url: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Maintenance: {
          type: 'object',
          properties: {
            maintenance_id: { type: 'string', format: 'uuid' },
            car_id: { type: 'string', format: 'uuid' },
            schedule_date: { type: 'string', format: 'date' },
            service_type: { type: 'string' },
            description: { type: 'string' },
            cost: { type: 'number' },
            performed_by: { type: 'string' },
            date_performed: { type: 'string', format: 'date' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          security: [],
          responses: { 200: { description: 'Server is running' } },
        },
      },
      '/test-db': {
        get: {
          tags: ['System'],
          summary: 'Database connection test',
          security: [],
          responses: { 200: { description: 'Database connected' } },
        },
      },
      '/vehicles': {
        get: {
          tags: ['Vehicles'],
          summary: 'List vehicles with filters and pagination',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['available', 'unavailable', 'maintenance'] } },
            { name: 'type', in: 'query', schema: { type: 'string' } },
            { name: 'transmission', in: 'query', schema: { type: 'string', enum: ['manual', 'automatic'] } },
            { name: 'fuel_type', in: 'query', schema: { type: 'string', enum: ['gasoline', 'diesel', 'electric', 'hybrid'] } },
            { name: 'min_capacity', in: 'query', schema: { type: 'integer' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'List of vehicles' } },
        },
        post: {
          tags: ['Vehicles'],
          summary: 'Create a vehicle (admin/staff)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Vehicle' } } } },
          responses: { 201: { description: 'Vehicle created' }, 400: { description: 'Validation error' }, 403: { description: 'Forbidden' } },
        },
      },
      '/vehicles/{id}': {
        get: {
          tags: ['Vehicles'],
          summary: 'Get a single vehicle',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Vehicle details' }, 404: { description: 'Not found' } },
        },
        put: {
          tags: ['Vehicles'],
          summary: 'Update a vehicle (admin/staff)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Vehicle updated' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' } },
        },
        delete: {
          tags: ['Vehicles'],
          summary: 'Archive a vehicle (admin/staff)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Vehicle archived' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' } },
        },
      },
      '/reservations': {
        get: {
          tags: ['Reservations'],
          summary: 'List reservations (role-filtered)',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'active', 'completed', 'cancelled', 'rejected'] } },
            { name: 'user_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'car_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'List of reservations' } },
        },
        post: {
          tags: ['Reservations'],
          summary: 'Create reservation(s) via DB function',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { reservations: { type: 'array' }, voucher_id: { type: 'string', nullable: true } } } } } },
          responses: { 201: { description: 'Reservations created' }, 400: { description: 'Validation error' } },
        },
      },
      '/reservations/{id}': {
        get: {
          tags: ['Reservations'],
          summary: 'Get a single reservation',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Reservation details' }, 404: { description: 'Not found' } },
        },
      },
      '/reservations/{id}/status': {
        put: {
          tags: ['Reservations'],
          summary: 'Transition booking status (admin/staff)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { new_status: { type: 'string', enum: ['pending', 'active', 'completed', 'cancelled', 'rejected'] }, rejection_reason: { type: 'string' } } } } } },
          responses: { 200: { description: 'Status updated' }, 400: { description: 'Invalid status' }, 403: { description: 'Forbidden' } },
        },
      },
      '/reservations/{id}/record-payment': {
        post: {
          tags: ['Reservations'],
          summary: 'Record down payment (admin/staff)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'number' }, payment_method: { type: 'string', enum: ['cash', 'gcash', 'bpi', 'bank_transfer'] }, reference_number: { type: 'string' } } } } } },
          responses: { 200: { description: 'Payment recorded' }, 400: { description: 'Validation error' }, 403: { description: 'Forbidden' } },
        },
      },
      '/transactions': {
        get: {
          tags: ['Transactions'],
          summary: 'List transactions (role-filtered)',
          parameters: [
            { name: 'reservation_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'payment_status', in: 'query', schema: { type: 'string', enum: ['completed', 'pending', 'failed', 'refunded'] } },
            { name: 'payment_method', in: 'query', schema: { type: 'string', enum: ['cash', 'gcash', 'bpi', 'bank_transfer'] } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'List of transactions' } },
        },
      },
      '/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'List notifications for current user',
          parameters: [
            { name: 'is_read', in: 'query', schema: { type: 'boolean' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'List of notifications' } },
        },
      },
      '/notifications/{id}/read': {
        put: { tags: ['Notifications'], summary: 'Mark notification as read', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Marked as read' }, 404: { description: 'Not found' } } },
      },
      '/notifications/read-all': {
        put: { tags: ['Notifications'], summary: 'Mark all notifications as read', responses: { 200: { description: 'All marked as read' } } },
      },
      '/documents': {
        get: {
          tags: ['Documents'],
          summary: 'List documents (role-filtered)',
          parameters: [
            { name: 'document_type', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'List of documents' } },
        },
        post: {
          tags: ['Documents'],
          summary: 'Create document record',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } } },
          responses: { 201: { description: 'Document created' }, 400: { description: 'Validation error' } },
        },
      },
      '/documents/{id}/status': {
        put: {
          tags: ['Documents'],
          summary: 'Approve or reject document (admin/staff)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['approved', 'rejected'] } } } } } },
          responses: { 200: { description: 'Status updated' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' } },
        },
      },
      '/maintenance': {
        get: {
          tags: ['Maintenance'],
          summary: 'List maintenance records (admin/staff)',
          parameters: [
            { name: 'car_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'service_type', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'List of records' } },
        },
        post: {
          tags: ['Maintenance'],
          summary: 'Create maintenance record (admin/staff)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Maintenance' } } } },
          responses: { 201: { description: 'Record created' }, 400: { description: 'Validation error' }, 403: { description: 'Forbidden' } },
        },
      },
      '/maintenance/{id}': {
        get: { tags: ['Maintenance'], summary: 'Get maintenance record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Record details' }, 404: { description: 'Not found' } } },
        put: { tags: ['Maintenance'], summary: 'Update maintenance record (admin/staff)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Record updated' }, 403: { description: 'Forbidden' } } },
        delete: { tags: ['Maintenance'], summary: 'Archive maintenance record (admin/staff)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Record archived' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' } } },
      },
      '/analytics/overview': {
        get: { tags: ['Analytics'], summary: 'KPI dashboard overview (admin/staff)', responses: { 200: { description: 'Dashboard metrics' }, 403: { description: 'Forbidden' } } },
      },
      '/analytics/revenue': {
        get: {
          tags: ['Analytics'],
          summary: 'Revenue breakdown (admin/staff)',
          parameters: [
            { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Revenue data' }, 403: { description: 'Forbidden' } },
        },
      },
      '/analytics/fleet': {
        get: { tags: ['Analytics'], summary: 'Fleet utilization stats (admin/staff)', responses: { 200: { description: 'Fleet stats per vehicle' }, 403: { description: 'Forbidden' } } },
      },
      '/users': {
        post: {
          tags: ['Users'],
          summary: 'Create user (admin only)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, phoneNumber: { type: 'string' }, roleId: { type: 'string', format: 'uuid' } } } } } },
          responses: { 201: { description: 'User created' }, 400: { description: 'Validation error' }, 403: { description: 'Forbidden' } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
