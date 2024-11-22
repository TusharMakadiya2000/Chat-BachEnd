// src/routes/UserRoutes.ts
import express from "express";
import User from "../models/User";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { generateToken } from "../utils/auth";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { authenticateToken } from "../middleware/authMiddleware";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { decryptData } from "../utils/encryption";
const router = express.Router();

// Configure AWS S3 client

const credentials = {
    accessKeyId: process.env.TEBI_S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.TEBI_S3_SECRET_ACCESS_KEY || "",
};

const s3Client = new S3Client({
    endpoint: process.env.TEBI_S3_ENDPOINT_URL,
    credentials: credentials,
    region: process.env.TEBI_S3_REGION,
});

// Profile Image Upload Route
router.get("/upload", async (req, res) => {
    try {
        const { filename, type } = req.query;

        if (!filename || !type) {
            return res
                .status(400)
                .json({ error: "Filename query parameter is required" });
        }

        // Generate a unique key for the S3 object
        const fileExt = (filename as string).split(".").pop() || "jpeg";
        const folder =
            type === "profileImage" ? "profile-images" : "cover-images";
        const key = `${folder}/${uuidv4()}.${fileExt}`;

        // Generate a presigned URL
        const command = new PutObjectCommand({
            Bucket: process.env.TEBI_S3_BUCKET_NAME,
            Key: key,
            ContentType: `image/${fileExt}`, // Set appropriate Content-Type based on file extension
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ key, url });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ------------------ Start: Register a new user ------------------ */

router.post("/register", async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            profileImage,
            status,
            archive,
            coverImage,
        } = req.body;
        const decryptedPassword = decryptData(password);
        const hashedPassword = await bcrypt.hash(decryptedPassword, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword,
            profileImage,
            status,
            archive,
            coverImage,
        });

        await user.save();
        res.status(201).send(user);
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(400).send({ error: "Failed to register user." });
    }
});

/* ------------------ End: Register a new user ------------------ */

/* ------------------ Start: Login Using Email and password ------------------ */

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).send({ error: "Invalid email." });
        }
        const encryptedPassword = decryptData(password);
        const isMatch = await bcrypt.compare(encryptedPassword, user.password);
        if (!isMatch) {
            return res.status(401).send({ error: "Invalid password." });
        }
        const token = generateToken(user._id, user.email, user.name);

        res.send({ user, token });
    } catch (error) {
        res.status(500).send(error);
    }
});

/* ------------------ End: Login Using Email and password ------------------ */

/* ------------------ Start: Get all users ------------------ */

router.get("/", authenticateToken, async (req, res) => {
    try {
        const users = await User.find({ status: { $ne: "deleted" } });
        res.status(200).send(users);
    } catch (error) {
        res.status(500).send(error);
    }
});

/* ------------------ End: Get all users ------------------ */

/* ------------------ Start: Get a user by ID ------------------ */

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send();
        }
        res.status(200).send(user);
    } catch (error) {
        res.status(500).send(error);
    }
});

/* ------------------ End: Get a user by ID ------------------ */

/* ------------------ Start: Update a user by ID ------------------ */

// Update User Cover Image Route
router.put("/users/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { coverImage } = req.body; // Assuming coverImage is being sent in the request body

        // Find user and update their coverImage
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { coverImage },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating cover image:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.put("/:id", authenticateToken, async (req, res) => {
    try {
        const { archive, ...updateFields } = req.body;
        const updateData = { ...updateFields };
        if (archive !== undefined) {
            updateData.archive = archive;
        }

        const item = await User.findByIdAndUpdate(req.params.id, updateData, {
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

/* ------------------ End: Update a user by ID ------------------ */

/* ------------------ Start: Soft delete user by updating its status ------------------ */

router.delete("/:id", authenticateToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status: "deleted" },
            { new: true }
        );

        if (!user) {
            return res.status(404).send({ error: "user not found" });
        }

        res.status(200).send(user);
    } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).send({ error: "Error updating user status" });
    }
});

/* ------------------ End: Soft delete user by updating its status ------------------ */

/* ------------------ Start: Forgot Password Route ------------------ */

router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }

        const otp = crypto.randomInt(100000, 999999).toString();

        user.otp = otp;
        await user.save();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Send OTP via email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset OTP",
            html: `<p>Hello,${user.name}</p>
           <p>We received a request to reset your password. Your OTP code is <strong>${otp}</strong>.</p>
           <p>Please use this code to proceed with the password reset. If you did not request a password reset, please ignore this email.</p>
           <p>Thank you,<br>DbCodder</p>`,
        });

        res.status(200).send({ message: "OTP sent to your email." });
    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).send({
            error: "Failed to send OTP. Please try again.",
        });
    }
});

/* ------------------ End: Forgot Password Route ------------------ */

/* ------------------ Start: Verify OTP Route ------------------ */

router.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user || user.otp !== otp) {
            return res.status(400).send({ error: "Invalid OTP." });
        }
        if (user.otp !== otp) {
            return res.status(400).send({ error: "Incorrect OTP." });
        }
        user.otp = undefined;
        await user.save();
        res.status(200).send({ message: "OTP verified successfully." });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).send({
            error: "Failed to verify OTP. Please try again.",
        });
    }
});

/* ------------------ End: Verify OTP Route ------------------ */

/* ------------------ Start: Reset Password with OTP ------------------ */

router.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }

        const encryptedPassword = decryptData(newPassword);
        const hashedPassword = await bcrypt.hash(encryptedPassword, 10);

        user.password = hashedPassword;

        await user.save();

        res.status(200).send({
            message: "Password has been reset successfully.",
        });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).send({
            error: "Failed to reset password. Please try again.",
        });
    }
});

/* ------------------ End: Reset Password with OTP ------------------ */

/* ------------------ Start: Change Password with Current Password ------------------ */

router.post("/change-password/:userId", authenticateToken, async (req, res) => {
    const { currentPassword, newPassword, userId } = req.body;
    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }
        const encryptedPassword = decryptData(currentPassword);

        const isMatch = await bcrypt.compare(encryptedPassword, user.password);
        if (!isMatch) {
            return res
                .status(400)
                .send({ error: "Incorrect current password." });
        }
        const encryptedNewPassword = decryptData(newPassword);

        const hashedPassword = await bcrypt.hash(encryptedNewPassword, 10);

        user.password = hashedPassword;
        await user.save();

        res.status(200).send({ message: "Password changed successfully." });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).send({
            error: "Failed to change password. Please try again.",
        });
    }
});

/* ------------------ End: Change Password with Current Password ------------------ */

export default router;
