// src/models/Group.ts
import { Schema, Types, model } from "mongoose";

enum UserRole {
    Admin = "admin",
    User = "user",
}

const groupUsersSchema = new Schema(
    {
        userId: { type: Types.ObjectId, required: true },
        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.User,
        },
    },
    { timestamps: true }
);
const groupSchema = new Schema(
    {
        name: { type: String, required: true },
        groupImage: { type: String, default: "" },
        coverImage: { type: String, default: "" },
        archive: { type: Boolean, default: false },
        status: { type: String, default: "active" },
        chat: { type: [String], default: [] },
        users: {
            type: [groupUsersSchema],
            default: [],
            validate: {
                validator: function (
                    users: Types.Array<typeof groupUsersSchema>
                ) {
                    return users.length <= 151;
                },
                message: "A group cannot have more than 151 users.",
            },
        },
    },
    { timestamps: true }
);

const Group = model("Group", groupSchema);

export default Group;
