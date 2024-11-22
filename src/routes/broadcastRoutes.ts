// src/routes/broadcastRoutes.ts
import express from "express";
import Broadcast from "../models/Broadcast";
import { Types } from "mongoose";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

/* ------------------ Start: Create a new broadcast ------------------ */

router.post("/", authenticateToken, async (req, res) => {
    try {
        const { name, broadcastImage, coverImage, chat, users } = req.body;

        if (!name || !Array.isArray(users)) {
            return res.status(400).send({ error: "Invalid request data" });
        }

        if (users.length > 101) {
            return res.status(400).send({
                error: "A broadcast cannot have more than 101 users.",
            });
        }

        const broadcast = new Broadcast(req.body);
        await broadcast.save();
        res.status(201).send(broadcast);
    } catch (error) {
        console.error(error);
        res.status(400).send(error);
    }
});

/* ------------------ End: Create a new broadcast ------------------ */

/* ------------------ Start: Get all broadcasts ------------------ */

router.get("/", authenticateToken, async (req, res) => {
    try {
        const broadcasts = await Broadcast.find({ status: { $ne: "deleted" } });
        res.status(200).send(broadcasts);
    } catch (error) {
        res.status(500).send(error);
    }
});

/* ------------------ End: Get all broadcasts ------------------ */

/* ------------------ Start: Get a broadcast by ID ------------------ */

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const broadcast = await Broadcast.findById(req.params.id);
        if (!broadcast) {
            return res.status(404).send();
        }
        res.status(200).send(broadcast);
    } catch (error) {
        res.status(500).send(error);
    }
});

/* ------------------ End: Get a broadcast by ID ------------------ */

/* ------------------ Start: Update a broadcast by ID ------------------ */

router.put("/:id", authenticateToken, async (req, res) => {
    try {
        const { archive, ...updateFields } = req.body;
        const updateData = { ...updateFields };
        if (archive !== undefined) {
            updateData.archive = archive;
        }

        const item = await Broadcast.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true,
            }
        );

        if (!item) {
            return res.status(404).send();
        }
        res.status(200).send(item);
    } catch (error) {
        res.status(400).send(error);
    }
});

/* ------------------ End: Update a broadcast by ID ------------------ */

/* ------------------ Start: Soft delete user by updating its status ------------------ */

router.delete("/:id", authenticateToken, async (req, res) => {
    try {
        const broadcast = await Broadcast.findByIdAndUpdate(
            req.params.id,
            { status: "deleted" },
            { new: true }
        );

        if (!broadcast) {
            return res.status(404).send({ error: "Broadcast not found" });
        }

        res.status(200).send(broadcast);
    } catch (error) {
        console.error("Error updating Broadcast status:", error);
        res.status(500).send({ error: "Error updating Broadcast status" });
    }
});

/* ------------------ End: Soft delete user by updating its status ------------------ */

/* ------------------ Start: Update broadcast users by ID ------------------ */

router.put("/:id/users", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { users } = req.body;

    if (!Array.isArray(users)) {
        return res.status(400).send({ error: "Users should be an array." });
    }

    try {
        const broadcast = await Broadcast.findById(id);
        if (!broadcast) {
            return res.status(404).send({ error: "broadcast not found." });
        }
        const totalUsers = broadcast.users.length + users.length;

        if (totalUsers > 101) {
            return res.status(400).send({
                error: "A broadcast cannot have more than 101 users.",
            });
        }

        users.forEach((user) => {
            if (
                !broadcast.users.some(
                    (existingUser) => existingUser.userId === user.userId
                )
            ) {
                broadcast.users.push(user);
            }
        });

        await broadcast.save();
        res.status(200).send(broadcast);
    } catch (error) {
        res.status(400).send(error);
    }
});

/* ------------------ End: Update broadcast users by ID ------------------ */

/* ------------------ Start: Update broadcast users by ID (removing a specific user) ------------------ */

router.delete("/:id/users/:userId", authenticateToken, async (req, res) => {
    const { id, userId } = req.params;

    if (!userId) {
        return res.status(400).send({ error: "User ID is required." });
    }

    try {
        const broadcast = await Broadcast.findById(id);
        if (!broadcast) {
            return res.status(404).send({ error: "broadcast not found." });
        }

        const objectUserId = new Types.ObjectId(userId);

        const broadcastUsers = broadcast.users.filter((user) => {
            return user.userId.toString() !== objectUserId.toString();
        });

        broadcast.set("users", broadcastUsers);

        await broadcast.save();
        res.status(200).send(broadcast);
    } catch (error) {
        console.error("Error removing user from broadcast:", error);
        res.status(500).send({ error: "Error removing user from broadcast" });
    }
});

/* ------------------ Start: Update broadcast users by ID (removing a specific user) ------------------ */

export default router;
