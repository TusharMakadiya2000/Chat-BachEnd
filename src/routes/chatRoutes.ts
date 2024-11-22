import express, { Request, Response } from "express";
import Chat from "../models/Chat";
import Broadcast from "../models/Broadcast";
import { Types } from "mongoose";
import User from "../models/User";
import { authenticateToken } from "../middleware/authMiddleware";
import { Server } from "socket.io";

const chatRoutes = (io: Server) => {
    const router = express.Router();

    /* ------------------ Start: Get Broadcast UserId using BroadcastId   ------------------ */

    router.post(
        "/send",
        authenticateToken,
        async (req: Request, res: Response) => {
            try {
                const {
                    type,
                    refId,
                    sender,
                    message,
                    receiver, // This is the array of user IDs from frontend
                    messageType,
                    deliverType,
                    imagename,
                    isForwarded,
                    docname1,
                    docname2,
                    docname3,
                    files,
                    replyTo,
                } = req.body.newMessage;

                // Validate request data
                if (
                    !type ||
                    !refId ||
                    !sender ||
                    !message ||
                    !receiver ||
                    !messageType ||
                    !deliverType ||
                    !imagename ||
                    !docname1 ||
                    !docname2 ||
                    !docname3 ||
                    !Array.isArray(files)
                ) {
                    return res.status(400).send({
                        error: "Missing required fields or incorrect data format",
                    });
                }

                // Find user details based on receiver userIds
                const userIds = receiver.map((rec: any) => rec.userId); // Extract userIds from receiver array
                const users = await User.find({
                    _id: { $in: userIds },
                }).select("name"); // Fetch only the `name` field for these users

                // Create a map of userId -> userName
                const userMap = new Map(
                    users.map((user) => [user._id.toString(), user.name])
                );

                const chatPromises = [];

                // Handle broadcast type
                if (type === "broadcast") {
                    // Use the `receiver` array from the frontend directly
                    receiver.forEach((rec: any) => {
                        const userName = userMap.get(rec.userId) || "Unknown"; // Get the user name from the map

                        chatPromises.push(
                            new Chat({
                                type,
                                refId,
                                sender,
                                receiver: {
                                    userId: rec.userId,
                                    name: userName, // Assign the found user name
                                },
                                message,
                                messageType,
                                deliverType,
                                imagename,
                                isForwarded,
                                docname1,
                                docname2,
                                docname3,
                                files,
                                replyTo,
                            }).save()
                        );
                    });
                } else {
                    // If not broadcast, just save the chat normally
                    const chatEntry = new Chat({
                        type,
                        refId,
                        sender,
                        message,
                        receiver, // receiver already passed from frontend
                        messageType,
                        deliverType,
                        imagename,
                        isForwarded,
                        docname1,
                        docname2,
                        docname3,
                        files,
                        replyTo,
                    });
                    chatPromises.push(chatEntry.save());
                }

                // Await all chat saves
                await Promise.all(chatPromises);
                res.status(201).send(chatPromises);
            } catch (error) {
                console.error("Error in Save Chat.", error);
                res.status(400).send({ error: error });
            }
        }
    );

    /* ------------------ End: Save Chat Personal, Group and Broadcast  ------------------ */

    /* ------------------ Start: Update Chat Personal, Group and Broadcast  ------------------ */

    router.put(
        "/update/:messageId",
        authenticateToken,
        async (req: Request, res: Response) => {
            const { messageId } = req.params;
            const { message } = req.body; // Assuming the new message text is sent in the request body

            if (!message) {
                return res.status(400).send("Message content is required.");
            }

            try {
                // Find the message by ID and update it
                const updatedMessage = await Chat.findByIdAndUpdate(
                    messageId,
                    { message }, // Update only the message content
                    { new: true, runValidators: true } // Return the updated document
                );

                if (!updatedMessage) {
                    return res.status(404).send("Message not found.");
                }

                res.send(updatedMessage);
            } catch (error) {
                console.error("Error updating message:", error);
                res.status(500).send(error);
            }
        }
    );

    /* ------------------ End: Update Chat Personal, Group and Broadcast  ------------------ */

    /* ------------------ Start: Get messages between two users  ------------------ */

    router.get(
        "/messages/:userId1/:userId2",
        authenticateToken,
        async (req: Request, res: Response) => {
            const { userId1, userId2 } = req.params;
            const { type } = req.query;
            const skip = req.query.skip
                ? parseInt(req.query.skip as string)
                : 0;
            const limit = req.query.limit
                ? parseInt(req.query.limit as string)
                : 50;

            try {
                const matchConditions: any = {
                    status: { $ne: "deleted" },
                };

                if (type === "broadcast") {
                    matchConditions.type = "broadcast";
                    matchConditions.$or = [
                        {
                            "sender.userId": new Types.ObjectId(userId1),
                        },
                        {
                            "receiver.userId": new Types.ObjectId(userId1),
                        },
                    ];
                } else if (type === "group") {
                    matchConditions.type = "group";
                    matchConditions.$or = [
                        {
                            "receiver.userId": new Types.ObjectId(userId2),
                        },
                    ];
                } else {
                    matchConditions.$or = [
                        {
                            "sender.userId": new Types.ObjectId(userId1),
                            "receiver.userId": new Types.ObjectId(userId2),
                        },
                        {
                            "sender.userId": new Types.ObjectId(userId2),
                            "receiver.userId": new Types.ObjectId(userId1),
                        },
                    ];
                }

                const aggregationPipeline: any[] = [
                    {
                        $match: matchConditions,
                    },
                    {
                        $sort: { createdAt: -1 },
                    },
                ];

                if (type === "broadcast") {
                    aggregationPipeline.push(
                        {
                            $group: {
                                _id: "$createdAt",
                                originalIds: { $push: "$_id" },
                                message: { $first: "$message" },
                                refId: { $first: "$refId" },
                                messageType: { $first: "$messageType" },
                                deliverType: { $first: "$deliverType" },
                                type: { $first: "$type" },
                                createdAt: { $first: "$createdAt" },
                                updatedAt: { $first: "$updatedAt" },
                                isForwarded: { $first: "$isForwarded" },
                                files: { $first: "$files" },
                                sender: { $first: "$sender" },
                                receivers: { $push: "$receiver" },
                            },
                        },
                        { $sort: { createdAt: -1 } }
                    );
                }

                aggregationPipeline.push({ $skip: skip }, { $limit: limit });

                aggregationPipeline.push({
                    $project: {
                        _id: 1,
                        originalIds: 1,
                        message: 1,
                        refId: 1,
                        messageType: 1,
                        deliverType: 1,
                        type: 1,
                        createdAt: 1,
                        isForwarded: 1,
                        updatedAt: 1,
                        files: 1,
                        sender: 1,
                        replyTo: 1,
                        receiver:
                            type === "broadcast" ? "$receivers" : "$receiver",
                    },
                });

                const messages = await Chat.aggregate(aggregationPipeline);

                res.send(messages);
            } catch (error) {
                console.error("Error fetching Chats.:", error);
                res.status(500).send(error);
            }
        }
    );

    /* ------------------ End: Get messages between two users  ------------------ */

    /* ------------------ Start: Update DeliverType  ------------------ */

    router.post(
        "/updateDeliverType",
        authenticateToken,
        async (req: Request, res: Response) => {
            const { senderId, receiverId, deliverType, type } = req.body;

            const senderObjectId = new Types.ObjectId(senderId);
            const receiverObjectIds = receiverId.map(
                (id: string) => new Types.ObjectId(id)
            );
            try {
                // Initialize match conditions
                let matchConditions: any = {
                    deliverType: { $in: ["sent", "unread"] },
                };

                // Define conditions based on chat type
                if (type === "group") {
                    matchConditions.type = "group";
                    matchConditions["receiver.userId"] = receiverObjectIds;
                } else {
                    // Default to personal chat type
                    matchConditions.$or = [
                        {
                            "sender.userId": senderObjectId,
                            "receiver.userId": receiverObjectIds,
                        },
                        {
                            "sender.userId": senderObjectId,
                            "receiver.userId": receiverObjectIds,
                        },
                    ];
                }

                const updateDeliverType = await Chat.updateMany(
                    matchConditions,
                    { $set: { deliverType: deliverType } }
                );

                if (updateDeliverType.matchedCount === 0) {
                    return res
                        .status(404)
                        .send("No messages matched the query.");
                }

                res.status(200).send(updateDeliverType);
            } catch (error) {
                console.error("Error updating deliver type:", error);
                res.status(500).send("Failed to update deliver type.");
            }
        }
    );

    /* ------------------ End: Update DeliverType  ------------------ */

    /* ------------------ Start: Get Count of Unread and Sent Messages.  ------------------ */

    router.get("/unreadCount/:loggedInUserId", async (req, res) => {
        const { loggedInUserId } = req.params;

        try {
            const count = await Chat.countDocuments({
                receiver: { $elemMatch: { userId: loggedInUserId } },
                deliverType: { $in: ["sent", "unread"] },
            });

            const messages = await Chat.find({
                receiver: { $elemMatch: { userId: loggedInUserId } },
                deliverType: { $in: ["sent", "unread"] },
            })
                .sort({ createdAt: -1 })
                .limit(50);

            res.status(200).send({ count, messages });
        } catch (error) {
            console.error("Error fetching unread count:", error);
            res.status(500).send("Failed to fetch unread count.");
        }
    });

    /* ------------------ : Get Count of Unread and Sent Messages.  ------------------ */

    router.put(
        "/deliverTypeUpdate",
        authenticateToken,
        async (req: Request, res: Response) => {
            const { messageId, deliverType } = req.body;

            if (!messageId || !deliverType) {
                return res
                    .status(400)
                    .json({ message: "Missing required fields." });
            }

            try {
                // Convert messageId to ObjectId for MongoDB compatibility
                const chatId = new Types.ObjectId(messageId);

                // Update deliverType in the database
                const result = await Chat.updateOne(
                    { _id: chatId },
                    { $set: { deliverType: deliverType } }
                );

                // Check if the message was updated
                res.status(200).json({
                    message: "deliverType updated successfully.",
                });
            } catch (error) {
                console.error("Error updating deliverType:", error);
                res.status(500).json({ message: "Internal server error." });
            }
        }
    );
    /* ------------------ Start: Soft delete chat by updating its status  ------------------ */

    router.delete("/:id", async (req: Request, res: Response) => {
        const chatId = req.params.id;
        const { senderId, receiverId } = req.body;
        try {
            const chat = await Chat.findById(chatId);

            if (!chat) {
                return res.status(404).send({ error: "Chat not found" });
            }

            const updatedChat = await Chat.findByIdAndUpdate(
                chatId,
                { status: "deleted" },
                { new: true }
            );

            if (!updatedChat) {
                return res
                    .status(500)
                    .send({ error: "Failed to update chat status." });
            }

            io.to(receiverId).emit("messageDeleted", {
                messageId: chatId,
                senderId: senderId,
                receiverId: receiverId,
            });

            res.status(200).send(updatedChat);
        } catch (error) {
            console.error("Error updating chat status:", error);
            res.status(500).send({ error: "Error updating chat status." });
        }
    });

    /* ------------------ End: Soft delete chat by updating its status  ------------------ */

    return router;
};

export default chatRoutes;
