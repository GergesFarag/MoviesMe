import connectDB from "./Config/db";  // Your DB connection logic
import app from "./app";  // Import the Express app

(async () => {
  // Database connection
  await connectDB();
  console.log("Connected to the database");
  // const PORT = process.env.PORT_NUMBER || 3000;
  // const server = app.listen(PORT, () => {
  //   console.log(`Sever is running on : http://localhost:${PORT}/`);
  // });
  // process.on("unhandledRejection", (error) => {
  //   console.error("Unhandled Rejection:", error);
  //   server.close(() => {
  //     process.exit(1);
  //   });
  // });
})();
