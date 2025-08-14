import swaggerJsDoc from "swagger-jsdoc"
const swaggerDoc = swaggerJsDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MOVIX API DOCUMENTATION",
      version: "1.0.0",
      description: "A Text to Movie API that allows users to convert text into movie",
    },
  },
  apis: [
    `${__dirname}/swagger.yaml`,
  ],
})

export default swaggerDoc