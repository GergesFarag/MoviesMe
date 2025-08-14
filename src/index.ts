import app from "./app";
import connectDB from "./Config/db";
const PORT = process.env.PORT_NUMBER || 3000;
(async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`Sever is running on : http://localhost:${PORT}/`);
  });
  process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
    server.close(() => {
      process.exit(1);
    });
  });
})();
