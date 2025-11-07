import swaggerJsdoc from 'swagger-jsdoc';
import config from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SFA API Documentation',
      version: '1.0.0',
      description:
        'Live API documentation for the SFA backend application, built with Node.js, Express, and MongoDB.',
    },
    servers: [
      {
        url: `/api/v1`,
        description: 'Development Server',
      },
    ],
    // Define the security scheme (JWT)
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT in the format: Bearer <token>',
        },
      },
    },
  },
  // Path to the files containing OpenAPI definitions
  apis: ['./src/docs/**/*.yaml'],
};

export const swaggerSpec = swaggerJsdoc(options);