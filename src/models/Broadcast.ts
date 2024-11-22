// src/models/Group.ts
import { Schema, Types, model } from "mongoose";

const broadcastUsersSchema = new Schema(
    {
        userId: { type: Types.ObjectId, required: true },
    },
    { timestamps: true }
);
const broadcastSchema = new Schema(
    {
        name: { type: String, required: true },
        broadcastImage: { type: String, default: "" },
        coverImage: { type: String, default: "" },
        archive: { type: Boolean, default: false },
        status: { type: String, default: "active" },
        chat: { type: [String], default: [] },
        createdBy: { type: Types.ObjectId, ref: "User", required: true },
        users: {
            type: [broadcastUsersSchema],
            default: [],
            validate: {
                validator: function (
                    users: Types.Array<typeof broadcastUsersSchema>
                ) {
                    return users.length <= 101;
                },
                message: "A broadcast cannot have more than 101 users.",
            },
        },
    },
    { timestamps: true }
);

const Broadcast = model("Broadcast", broadcastSchema);

export default Broadcast;
