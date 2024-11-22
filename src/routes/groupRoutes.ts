// src/routes/groupRoutes.ts
import express from "express";
import Group from "../models/Group";
import { Types } from "mongoose";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

/* ------------------ Start: Create a new group ------------------ */

router.post("/", authenticateToken, async (req, res) => {
    try {
        const { name, groupImage, archive, coverImage, chat, users } = req.body;

        if (!name || !Array.isArray(users)) {
            return res.status(400).send({ error: "Invalid request data" });
        }
        if (users.length > 151) {
            return res.status(400).send({
                error: "A group cannot have more than 151 users.",
            });
        }
        const group = new Group(req.body);
        await group.save();
        res.status(201).send(group);
    } catch (error) {
        console.error(error);
        res.status(400).send(error);
    }
});

/* ------------------ End: Create a new group ------------------ */

/* ------------------ Start: Get all groups ------------------ */

router.get("/", authenticateToken, async (req, res) => {
    try {
        const groups = await Group.find({ status: { $ne: "deleted" } });
        res.status(200).send(groups);
    } catch (error) {
        res.status(500).send({ error: "Error fetching groups" });
    }
});

/* ------------------ End: Get all groups ------------------ */

/* ------------------ Start: Get a group by ID ------------------ */

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).send();
        }
        res.status(200).send(group);
    } catch (error) {
        res.status(500).send(error);
    }
});

/* ------------------ End: Get a group by ID ------------------ */

/* ------------------ Start: Update a group by ID ------------------ */

router.put("/:id", authenticateToken, async (req, res) => {
    try {
        const { archive, ...updateFields } = req.body;
        const updateData = { ...updateFields };
        if (archive !== undefined) {
            updateData.archive = archive;
        }

        const item = await Group.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!item) {
            return res.status(404).send();
        }
        res.status(200).send(item);
    } catch (error) {
        res.status(400).send(error);
    }
});

/* ------------------ End: Update a group by ID ------------------ */

/* ------------------ Start: Soft delete user by updating its status ------------------ */

router.delete("/:id", authenticateToken, async (req, res) => {
    try {
        const group = await Group.findByIdAndUpdate(
            req.params.id,
            { status: "deleted" },
            { new: true } // Return the updated document
        );

        if (!group) {
            return res.status(404).send({ error: "Group not found" });
        }

        res.status(200).send(group);
    } catch (error) {
        console.error("Error updating group status:", error);
        res.status(500).send({ error: "Error updating group status" });
    }
});

/* ------------------ End: Soft delete user by updating its status ------------------ */

/* ------------------ Start: Update group users by ID ------------------ */

router.put("/:id/users", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { users } = req.body;

    if (!Array.isArray(users)) {
        return res.status(400).send({ error: "Users should be an array." });
    }

    try {
        const group = await Group.findById(id);
        if (!group) {
            return res.status(404).send({ error: "Group not found." });
        }
        const totalUsers = group.users.length + users.length;

        if (totalUsers > 151) {
            return res.status(400).send({
                error: "A broadcast cannot have more than 151 users.",
            });
        }
        users.forEach((user) => {
            const existingUser = group.users.find(
                (existingUser) =>
                    existingUser.userId.toString() === user.userId.toString()
            );

            if (existingUser) {
                existingUser.role = user.role;
            } else {
                group.users.push(user);
            }
        });

        await group.save();
        res.status(200).send(group);
    } catch (error) {
        res.status(400).send(error);
    }
});

/* ------------------ End: Update group users by ID ------------------ */

/* ------------------ Start: Update group users by ID (removing a specific user) ------------------ */

router.delete("/:id/users/:userId", authenticateToken, async (req, res) => {
    const { id, userId } = req.params;

    if (!userId) {
        return res.status(400).send({ error: "User ID is required." });
    }

    try {
        const group = await Group.findById(id);
        if (!group) {
            return res.status(404).send({ error: "Group not found." });
        }

        const objectUserId = new Types.ObjectId(userId);

        const groupUsers = group.users.filter((user) => {
            return user.userId.toString() !== objectUserId.toString();
        });

        group.set("users", groupUsers);

        await group.save();
        res.status(200).send(group);
    } catch (error) {
        console.error("Error removing user from group:", error);
        res.status(500).send({ error: "Error removing user from group" });
    }
});

/* ------------------ End: Update group users by ID (removing a specific user) ------------------ */

export default router;
