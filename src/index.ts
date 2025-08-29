import app from "./app";
import connectDB from "./Config/db";
import { getIO, initSocket } from "./Sockets/socket";
const PORT = process.env.PORT_NUMBER || 3000;
(async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`Sever is running on : http://localhost:${PORT}/`);
    initSocket(server);
  });
  process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
    server.close(() => {
      getIO().emit("error", "Server is shutting down due to an error");
      process.exit(1);
    });
  });
})();