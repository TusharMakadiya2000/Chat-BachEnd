import { Schema, model, Document, Types } from "mongoose";

interface IChat extends Document {
    sender: {
        userId: Types.ObjectId;
        name: string;
    };
    receiver: {
        userId: Types.ObjectId;
        name: string;
    };
    messageType: string;
    deliverType: string;
    message: string;
    imagename?: string;
    refId?: Types.ObjectId;
    type: string;
    isForwarded?: boolean;
    docname1?: string;
    docicon?: string;
    docname2?: string;
    docname3?: string;
    status: string;
    files: Array<{
        filename: string;
        size: string;
    }>;
    replyTo?: Types.ObjectId;
}

const chatSchema = new Schema<IChat>(
    {
        sender: {
            userId: { type: Types.ObjectId, required: true },
            name: { type: String, required: true },
        },
        receiver: [
            {
                userId: {
                    type: Types.ObjectId,
                    required: true,
                },
                name: { type: String, required: true },
            },
        ],
        messageType: { type: String, required: true },
        deliverType: { type: String, required: true },
        message: { type: String, required: true },

        imagename: { type: String },
        type: { type: String, required: true },
        isForwarded: { type: Boolean, default: false },
        refId: { type: Types.ObjectId },
        docname1: { type: String },
        docicon: { type: String },
        docname2: { type: String },
        docname3: { type: String },
        status: { type: String, default: "active" },
        files: [
            {
                filename: { type: String, required: true },
                size: { type: String, required: true },
            },
        ],
        replyTo: { type: Types.ObjectId },
    },
    { timestamps: true }
);

const Chat = model<IChat>("Chat", chatSchema);

export default Chat;
