import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/mongoose";
import userRoutes from "./routes/userRoutes";
import groupRoutes from "./routes/groupRoutes";
import broadcastRoutes from "./routes/broadcastRoutes";
import chatRoutes from "./routes/chatRoutes";

const app = express();
const port = process.env.PORT || 5000;

// Whitelist of allowed origins
const whitelist = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://192.168.1.47:3000",
    "https://chat-app-w4lf.onrender.com/",
];

// CORS options
const corsOptions = {
    origin: function (origin: string | undefined, callback: any) {
        console.log("origin", origin); // For debugging purposes
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
};

// Create HTTP server and integrate Socket.IO
const server = createServer(app);
const io = new Server(server, {
    cors: corsOptions, // Using the same CORS options for Socket.IO
});

// Middleware
app.use(cors(corsOptions)); // Apply CORS middleware to express
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/broadcast", broadcastRoutes);
app.use("/api/chats", chatRoutes(io));

// Connect to MongoDB
connectDB();

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Listen for sendMessage event
    socket.on("sendMessage", (message) => {
        console.log("New message received:", message);

        // Broadcast the message to the receiver
        socket.broadcast.emit("receiveMessage", message);
    });

    // Listen for a message deletion event from a client
    socket.on("messageDeleted", ({ messageId, senderId, receiverId }) => {
        console.log(
            `Message with ID ${messageId} deleted by ${senderId} or ${receiverId}`
        );

        // Broadcast the deletion event to all connected clients, or a specific room/user
        io.emit("messageDeleted", { messageId, senderId, receiverId }); // Adjust this to target specific users/rooms if needed
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
