// backend/utils/socketHandler.js

import CallHistory from '../models/CallHistory.js';

const users = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> { caller, receiver, startTime, type }

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;
    console.log(`✅ User connected: ${userId} (Socket: ${socket.id})`);

    // Store user socket mapping
    users.set(userId, socket.id);
    
    // Notify others user is online
    socket.broadcast.emit('user:online', userId);

    // ============ CALL EVENTS ============

    // Handle call initiation
    socket.on('call:initiate', async (data) => {
      const { to, from, type, offer, callerInfo } = data;
      const receiverSocketId = users.get(to);

      console.log(`📞 Call initiated: ${from} -> ${to} (${type})`);

      if (receiverSocketId) {
        // Create call record
        const callId = `${from}-${to}-${Date.now()}`;
        activeCalls.set(callId, {
          caller: from,
          receiver: to,
          type,
          startTime: null,
          status: 'ringing'
        });

        // Send incoming call to receiver
        io.to(receiverSocketId).emit('call:incoming', {
          callId,
          from,
          type,
          offer,
          callerInfo
        });

        console.log(`🔔 Incoming call sent to ${to}`);
      } else {
        // Receiver is offline - save as missed call immediately
        socket.emit('call:user-offline', { to });
        
        await CallHistory.create({
          caller: from,
          receiver: to,
          type,
          status: 'missed',
          duration: 0
        });

        console.log(`📵 User ${to} is offline - call marked as missed`);
      }
    });

    // Handle call answer
    socket.on('call:answer', async (data) => {
      const { callId, answer } = data;
      const call = activeCalls.get(callId);

      if (call) {
        call.startTime = Date.now();
        call.status = 'connected';
        activeCalls.set(callId, call);

        const callerSocketId = users.get(call.caller);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call:answered', {
            callId,
            answer
          });
        }

        console.log(`✅ Call answered: ${callId}`);
      }
    });

    // Handle call rejection
    socket.on('call:reject', async (data) => {
      const { callId, to } = data;
      const call = activeCalls.get(callId);

      if (call) {
        // Save rejected call to history
        await CallHistory.create({
          caller: call.caller,
          receiver: call.receiver,
          type: call.type,
          status: 'rejected',
          duration: 0
        });

        const callerSocketId = users.get(call.caller);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call:rejected', { callId });
        }

        activeCalls.delete(callId);
        console.log(`❌ Call rejected: ${callId}`);
      }
    });

    // Handle call end
    socket.on('call:end', async (data) => {
      const { callId, to } = data;
      const call = activeCalls.get(callId);

      if (call) {
        const duration = call.startTime 
          ? Math.floor((Date.now() - call.startTime) / 1000) 
          : 0;

        // Save call to history
        await CallHistory.create({
          caller: call.caller,
          receiver: call.receiver,
          type: call.type,
          status: call.startTime ? 'answered' : 'cancelled',
          duration
        });

        // Notify the other user
        const otherUserId = call.caller === userId ? call.receiver : call.caller;
        const otherSocketId = users.get(otherUserId);
        
        if (otherSocketId) {
          io.to(otherSocketId).emit('call:ended', { callId, duration });
        }

        activeCalls.delete(callId);
        console.log(`📴 Call ended: ${callId}, Duration: ${duration}s`);
      }
    });

    // If caller cancels before answer (missed call)
    socket.on('call:cancel', async (data) => {
      const { callId, to } = data;
      const call = activeCalls.get(callId);

      if (call && !call.startTime) {
        // Save as missed call
        await CallHistory.create({
          caller: call.caller,
          receiver: call.receiver,
          type: call.type,
          status: 'missed',
          duration: 0
        });

        const receiverSocketId = users.get(to);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('call:missed', { callId });
        }

        activeCalls.delete(callId);
        console.log(`📵 Call missed: ${callId}`);
      }
    });

    // ============ WEBRTC SIGNALING ============

    socket.on('call:offer', (data) => {
      const { to, offer } = data;
      const receiverSocketId = users.get(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call:offer', {
          from: userId,
          offer
        });
      }
    });

    socket.on('call:answer-signal', (data) => {
      const { to, answer } = data;
      const callerSocketId = users.get(to);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call:answer-signal', {
          from: userId,
          answer
        });
      }
    });

    socket.on('call:ice-candidate', (data) => {
      const { to, candidate } = data;
      const receiverSocketId = users.get(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call:ice-candidate', {
          from: userId,
          candidate
        });
      }
    });

    // ============ MESSAGE EVENTS ============

    socket.on('message:send', (data) => {
      const { receiverId, text, senderId } = data;
      const receiverSocketId = users.get(receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:receive', data);
      }
    });

    socket.on('typing:start', (receiverId) => {
      const receiverSocketId = users.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user:typing', userId);
      }
    });

    socket.on('typing:stop', (receiverId) => {
      const receiverSocketId = users.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user:stop-typing', userId);
      }
    });

    // ============ DISCONNECT ============

    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${userId}`);
      users.delete(userId);
      
      // Notify others user is offline
      socket.broadcast.emit('user:offline', userId);

      // End any active calls for this user
      for (const [callId, call] of activeCalls.entries()) {
        if (call.caller === userId || call.receiver === userId) {
          const otherUserId = call.caller === userId ? call.receiver : call.caller;
          const otherSocketId = users.get(otherUserId);

          if (otherSocketId) {
            io.to(otherSocketId).emit('call:ended', { 
              callId, 
              reason: 'disconnect' 
            });
          }

          // Save call history
          const duration = call.startTime 
            ? Math.floor((Date.now() - call.startTime) / 1000) 
            : 0;

          await CallHistory.create({
            caller: call.caller,
            receiver: call.receiver,
            type: call.type,
            status: call.startTime ? 'answered' : 'missed',
            duration
          });

          activeCalls.delete(callId);
        }
      }
    });
  });
};

export default setupSocketHandlers;