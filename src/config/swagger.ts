import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Go-eat API Documentation',
      version: '1.0.0',
      description: 'API documentation for the Go-eat food delivery platform. Mirroring Just Eat functionality with real-time updates.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://go-eat-server.onrender.com',
        description: 'Production server on Render',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['customer', 'vendor', 'rider', 'admin'] },
          },
        },
        Restaurant: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            cuisine: { type: 'array', items: { type: 'string' } },
            deliveryFee: { type: 'number' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            totalAmount: { type: 'number' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            rating: { type: 'number', minimum: 1, maximum: 5 },
            comment: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        FoodItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            description: { type: 'string' },
            isAvailable: { type: 'boolean' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/models/*.ts', './dist/routes/*.js', './dist/models/*.js'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
