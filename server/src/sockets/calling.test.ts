import assert from 'node:assert/strict';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

// Ensure JWT env secrets are set prior to importing services
process.env.JWT_ACCESS_SECRET = 'test_jwt_secret_key_calling_12345';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_calling_12345';
process.env.VOICE_VIDEO_CALLS_ENABLED = 'true';

async function runCallingIntegrationTests() {
  console.log('\n--- Running WebRTC Calling Integration Tests ---');

  const { setupSockets } = await import('./socket.js');
  const { generateAccessToken } = await import('../services/jwt.service.js');

  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  setupSockets(io);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as any).port;
  console.log(`[Test Setup] Ephemeral test socket server listening on port ${port}`);

  const userA = { userId: '60c72b2f9b1d8b2d88c8e111', email: 'alice@example.com', displayName: 'Alice Caller' };
  const userB = { userId: '60c72b2f9b1d8b2d88c8e222', email: 'bob@example.com', displayName: 'Bob Recipient' };


  const tokenA = generateAccessToken({ userId: userA.userId, email: userA.email });
  const tokenB = generateAccessToken({ userId: userB.userId, email: userB.email });

  let clientA: ClientSocket;
  let clientB: ClientSocket;

  try {
    // 1. Connection test
    await new Promise<void>((resolve, reject) => {
      let count = 0;
      clientA = Client(`http://localhost:${port}`, { auth: { token: tokenA } });
      clientB = Client(`http://localhost:${port}`, { auth: { token: tokenB } });

      const check = () => {
        count++;
        if (count === 2) resolve();
      };

      clientA.on('connect', check);
      clientB.on('connect', check);
      clientA.on('connect_error', (err: any) => reject(new Error(`ClientA error: ${err.message}`)));
      clientB.on('connect_error', (err: any) => reject(new Error(`ClientB error: ${err.message}`)));
    });
    console.log('✔ Test 1: Sockets A & B connected and authenticated via JWT');

    // 2. call_offer -> call_answer setup flow
    const callId = 'call_session_789';
    const mockOfferSdp = { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1...' };
    const mockAnswerSdp = { type: 'answer', sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1...' };

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('call_offer test timed out')), 5000);

      clientB.once('call_offer', (offerData: any) => {
        try {
          assert.equal(offerData.callId, callId);
          assert.equal(offerData.callerId, userA.userId);
          assert.equal(offerData.isVideo, true);
          assert.deepEqual(offerData.sdp, mockOfferSdp);

          // Bob answers
          clientB.emit('call_answer', {
            callId,
            callerId: userA.userId,
            sdp: mockAnswerSdp,
          });
        } catch (err) {
          reject(err);
        }
      });

      clientA.once('call_answer', (answerData: any) => {
        try {
          assert.equal(answerData.callId, callId);
          assert.equal(answerData.recipientId, userB.userId);
          assert.deepEqual(answerData.sdp, mockAnswerSdp);
          clearTimeout(timeout);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      clientA.emit('call_offer', {
        callId,
        recipientId: userB.userId,
        isVideo: true,
        sdp: mockOfferSdp,
        callerInfo: { userId: userA.userId, displayName: userA.displayName },
      });
    });
    console.log('✔ Test 2: Signaling call_offer -> call_answer flow succeeded');

    // 3. ICE candidate exchange
    const mockCandidate = { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.5 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('ice_candidate test timed out')), 5000);

      clientB.once('ice_candidate', (iceData: any) => {
        try {
          assert.equal(iceData.callId, callId);
          assert.equal(iceData.senderUserId, userA.userId);
          assert.deepEqual(iceData.candidate, mockCandidate);
          clearTimeout(timeout);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      clientA.emit('ice_candidate', {
        callId,
        targetUserId: userB.userId,
        candidate: mockCandidate,
      });
    });
    console.log('✔ Test 3: ICE Candidate trickle exchange succeeded');

    // 4. Call teardown (call_end)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('call_end test timed out')), 5000);

      clientB.once('call_end', (endData: any) => {
        try {
          assert.equal(endData.callId, callId);
          assert.equal(endData.endedBy, userA.userId);
          assert.equal(endData.reason, 'user_hung_up');
          clearTimeout(timeout);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      clientA.emit('call_end', {
        callId,
        targetUserId: userB.userId,
        reason: 'user_hung_up',
      });
    });
    console.log('✔ Test 4: Call teardown (call_end) succeeded');

    // 5. Call rejection (call_reject)
    const rejectCallId = 'call_session_999';
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('call_reject test timed out')), 5000);

      clientA.once('call_reject', (rejectData: any) => {
        try {
          assert.equal(rejectData.callId, rejectCallId);
          assert.equal(rejectData.recipientId, userB.userId);
          assert.equal(rejectData.reason, 'busy');
          clearTimeout(timeout);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      clientB.emit('call_reject', {
        callId: rejectCallId,
        callerId: userA.userId,
        reason: 'busy',
      });
    });
    console.log('✔ Test 5: Call rejection (call_reject) succeeded');

    // 6. Feature Flag Disabled test
    process.env.VOICE_VIDEO_CALLS_ENABLED = 'false';
    await new Promise<void>((resolve, reject) => {
      clientA.emit(
        'call_offer',
        {
          callId: 'blocked_call_1',
          recipientId: userB.userId,
          isVideo: false,
          sdp: { type: 'offer', sdp: 'dummy' },
          callerInfo: { userId: userA.userId, displayName: userA.displayName },
        },
        (res: { success: boolean; error?: string }) => {
          try {
            assert.equal(res.success, false);
            assert.match(res.error || '', /disabled/i);
            process.env.VOICE_VIDEO_CALLS_ENABLED = 'true'; // restore
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      );
    });
    console.log('✔ Test 6: Feature flag VOICE_VIDEO_CALLS_ENABLED=false correctly blocked call_offer');

    console.log('\n--- All 6 Integration Tests Passed Successfully! ---\n');
  } finally {
    if (clientA!) clientA.disconnect();
    if (clientB!) clientB.disconnect();
    io.close();
    httpServer.close();
  }
}

runCallingIntegrationTests().catch((err) => {
  console.error('❌ Calling Integration Tests Failed:', err);
  process.exit(1);
});
