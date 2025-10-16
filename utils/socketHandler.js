
// setupSocketHandlers.js/backend/utils
import CallHistory from "../models/CallHistory.js";

const users = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> call data

export const setupSocketHandlers = (io) => {
  console.log("🔌 setupSocketHandlers initialized");

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;
    console.log(`\n✅ USER CONNECTED`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Total users: ${users.size + 1}`);

    // Store user
    users.set(userId, socket.id);
    console.log(`   Users online: ${Array.from(users.keys()).join(", ")}`);

    // Broadcast online status
    socket.broadcast.emit("user:online", userId);

    // ============ CALL EVENTS ============

    socket.on("call:initiate", async (data) => {
      console.log(`\n📞 EVENT: call:initiate received`);
      console.log(`   From: ${data.from}`);
      console.log(`   To: ${data.to}`);
      console.log(`   Type: ${data.type}`);

      const { to, from, type, offer, callerInfo, callId } = data;
      const receiverSocketId = users.get(to);

      console.log(`   Receiver socket ID: ${receiverSocketId || "NOT FOUND"}`);
      console.log(`   Available users: ${Array.from(users.entries()).map(([id, sid]) => `${id}:${sid}`).join(", ")}`);

      if (receiverSocketId) {
        // Use provided callId or generate one
        const finalCallId = callId || `${from}-${to}-${Date.now()}`;
        
        activeCalls.set(finalCallId, {
          caller: from,
          receiver: to,
          type,
          startTime: null,
          status: "ringing",
        });

        console.log(`   ✅ EMITTING call:incoming to ${to}`);
        console.log(`   Call ID: ${finalCallId}`);

        io.to(receiverSocketId).emit("call:incoming", {
          callId: finalCallId,
          from,
          type,
          // offer,
          callerInfo,
        });
       io.to(receiverSocketId).emit("call:offer", {
          from,
          callId: finalCallId,
          offer,
        });

        console.log(`   ✅ WebRTC offer sent to receiver`);
      } else {
        console.log(`   ❌ RECEIVER OFFLINE`);
        socket.emit("call:user-offline", { to });

        await CallHistory.create({
          caller: from,
          receiver: to,
          type,
          status: "missed",
          duration: 0,
        });
      }
    });

    socket.on("call:answer", async (data) => {
      console.log(`\n✅ EVENT: call:answer received`);
      console.log(`   Call ID: ${data.callId}`);
      console.log(`   From: ${data.from}`);
      console.log(`   To: ${data.to}`);

      const { callId, answer, to } = data;
      const call = activeCalls.get(callId);

      if (call) {
        call.startTime = Date.now();
        call.status = "connected";
        activeCalls.set(callId, call);

        const callerSocketId = users.get(to || call.caller);
        if (callerSocketId) {
          io.to(callerSocketId).emit("call:answered", {
            callId,
            answer,
          });
          console.log(`   ✅ Answer sent to caller`);
        }
      } else {
        console.log(`   ⚠️ Call not found`);
      }
    });

    socket.on("call:reject", async (data) => {
      console.log(`\n❌ EVENT: call:reject received`);
      console.log(`   Call ID: ${data.callId}`);

      const { callId, to } = data;
      const call = activeCalls.get(callId);

      if (call) {
        await CallHistory.create({
          caller: call.caller,
          receiver: call.receiver,
          type: call.type,
          status: "rejected",
          duration: 0,
        });

        const callerSocketId = users.get(to || call.caller);
        if (callerSocketId) {
          io.to(callerSocketId).emit("call:rejected", { callId });
        }

        activeCalls.delete(callId);
        console.log(`   ✅ Call rejected and removed from active calls`);
      }
    });

    socket.on("call:end", async (data) => {
      console.log(`\n📴 EVENT: call:end received`);
      console.log(`   Call ID: ${data.callId}`);
      console.log(`   User ID: ${data.userId || userId}`);


      const { callId, to, userId: endingUserId } = data;
      const call = activeCalls.get(callId);

      if (call) {
        const duration = call.startTime
          ? Math.floor((Date.now() - call.startTime) / 1000)
          : 0;

        await CallHistory.create({
          caller: call.caller,
          receiver: call.receiver,
          type: call.type,
          status: call.startTime ? "answered" : "cancelled",
          duration,
        });

        const otherUserId = to || (call.caller === (endingUserId || userId) ? call.receiver : call.caller);
        const otherSocketId = users.get(otherUserId);

        if (otherSocketId) {
          io.to(otherSocketId).emit("call:ended", { callId, duration });
        }

        activeCalls.delete(callId);
        console.log(`   ✅ Call ended, saved, and removed from active calls`);
      } else {
        console.log(`   ⚠️ Call not found in activeCalls`);
        console.log(`   Active calls: ${Array.from(activeCalls.keys()).join(", ")}`);
      }
    });

    // ============ WEBRTC SIGNALING ============

    socket.on("call:offer", (data) => {
      console.log(`📨 EVENT: call:offer received from ${userId}`);
      const { to, offer, callId } = data;
      const receiverSocketId = users.get(to);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:offer", {
          from: userId,
          callId,
          offer,
        });
        console.log(`   ✅ Offer forwarded to ${to}`);
      }
    });

    socket.on("call:answer-signal", (data) => {
      console.log(`📨 EVENT: call:answer-signal received from ${userId}`);
      const { to, answer, callId } = data;
      const callerSocketId = users.get(to);

      if (callerSocketId) {
        io.to(callerSocketId).emit("call:answer-signal", {
          from: userId,
          callId,
          answer,
        });
        console.log(`   ✅ Answer forwarded to ${to}`);
      }
    });

    socket.on("call:ice-candidate", (data) => {
      const { to, candidate, callId } = data;
      const receiverSocketId = users.get(to);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:ice-candidate", {
          from: userId,
          callId,
          candidate,
        });
      }
    });

    // ============ MESSAGE EVENTS ============

    socket.on("message:send", (data) => {
      const { receiverId } = data;
      const receiverSocketId = users.get(receiverId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message:receive", data);
      }
    });

    socket.on("typing:start", (receiverId) => {
      const receiverSocketId = users.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("user:typing", userId);
      }
    });

    socket.on("typing:stop", (receiverId) => {
      const receiverSocketId = users.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("user:stop-typing", userId);
      }
    });

    // ============ DISCONNECT ============

    socket.on("disconnect", () => {
      console.log(`\n❌ USER DISCONNECTED`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Socket ID: ${socket.id}`);

      users.delete(userId);
      socket.broadcast.emit("user:offline", userId);

      console.log(`   Users remaining: ${users.size}`);
      console.log(`   Remaining users: ${Array.from(users.keys()).join(", ")}\n`);

      // End active calls
      for (const [callId, call] of activeCalls.entries()) {
        if (call.caller === userId || call.receiver === userId) {
          const otherUserId = call.caller === userId ? call.receiver : call.caller;
          const otherSocketId = users.get(otherUserId);

          if (otherSocketId) {
            io.to(otherSocketId).emit("call:ended", {
              callId,
              reason: "disconnect",
            });
          }

          const duration = call.startTime
            ? Math.floor((Date.now() - call.startTime) / 1000)
            : 0;

          CallHistory.create({
            caller: call.caller,
            receiver: call.receiver,
            type: call.type,
            status: call.startTime ? "answered" : "missed",
            duration,
          });

          activeCalls.delete(callId);
        }
      }
    });
  });
};

export default setupSocketHandlers;