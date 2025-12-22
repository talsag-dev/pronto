import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  getOrCreateSession, 
  getSessionStatus, 
  requestPairingCode, 
  logoutSession,
  sendMessage,
  sessionEmitter
} from './manager';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Auth middleware (simple secret check)
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret';
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers['x-worker-secret'];
  if (token !== WORKER_SECRET) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Init session / Get QR
app.post('/session/:orgId/init', authenticate, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { forceNew } = req.body;
    await getOrCreateSession(orgId, forceNew);
    const status = getSessionStatus(orgId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get status
app.get('/session/:orgId/status', authenticate, (req, res) => {
  const { orgId } = req.params;
  const status = getSessionStatus(orgId);
  res.json(status);
});

// SSE for status updates
app.get('/session/:orgId/sse', (req, res) => {
  const { orgId } = req.params;
  const secret = req.query.secret;

  // Manual auth check for SSE (since headers might be harder in some SSE clients, though we'll use them if possible)
  if (secret !== WORKER_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log(`[SSE] Client connected for org: ${orgId}`);

  // Send initial status
  const initialStatus = getSessionStatus(orgId);
  res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

  const onUpdate = (status: any) => {
    res.write(`data: ${JSON.stringify(status)}\n\n`);
  };

  sessionEmitter.on(`update:${orgId}`, onUpdate);

  req.on('close', () => {
    console.log(`[SSE] Client disconnected for org: ${orgId}`);
    sessionEmitter.off(`update:${orgId}`, onUpdate);
  });
});

// Request Pairing Code
app.post('/session/:orgId/pairing-code', authenticate, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        res.status(400).json({ error: 'phoneNumber is required' });
        return;
    }

    const code = await requestPairingCode(orgId, phoneNumber);
    res.json({ code });
  } catch (error: any) {
    console.error('Pairing code error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send Message
app.post('/session/:orgId/message', authenticate, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { to, message } = req.body;
    
    if (!to || !message) {
        res.status(400).json({ error: 'to and message are required' });
        return;
    }

    const result = await sendMessage(orgId, to, message);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.delete('/session/:orgId', authenticate, async (req, res) => {
  try {
    const { orgId } = req.params;
    await logoutSession(orgId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Worker service running at http://localhost:${port}`);
  
  // Restore sessions in background
  import('./manager').then(m => m.initAllActiveSessions()).catch(console.error);
});
