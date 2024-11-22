// src/models/User.ts
import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        name: { type: String, required: true },
        email: {
            type: String,
            required: true,
            unique: true,
            match: [/.+@.+\..+/, "Please enter a valid email address"],
        },
        profileImage: { type: String, default: "" },
        status: { type: String, default: "offline" },
        archive: { type: Boolean, default: false },
        coverImage: { type: String, default: "" },
        password: { type: String, required: true, minlength: 8 },
        otp: { type: String },
    },
    { timestamps: true }
);

const User = model("User", userSchema);

export default User;
