import { Router, Request, Response } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { readFileSync, existsSync } from "fs";
import path from "path";

const router = Router();

const N8N_TEMPLATE = {
  name: "WhatsApp Manager Workflow",
  nodes: [
    {
      id: "webhook-trigger",
      name: "WhatsApp Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [240, 300],
      parameters: {
        path: "whatsapp-events",
        responseMode: "onReceived",
        httpMethod: "POST",
      },
    },
    {
      id: "set-message",
      name: "Format Message",
      type: "n8n-nodes-base.set",
      typeVersion: 1,
      position: [460, 300],
      parameters: {
        values: {
          string: [
            { name: "sessionId", value: "={{$json.sessionId}}" },
            { name: "to", value: "={{$json.message.from}}" },
            { name: "message", value: "تم استلام رسالتك: {{$json.message.body}}" },
          ],
        },
      },
    },
    {
      id: "send-reply",
      name: "Send WhatsApp Reply",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4,
      position: [680, 300],
      parameters: {
        method: "POST",
        url: "={{$vars.SERVER_URL}}/api/send/text",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "X-API-Key", value: "={{$vars.API_KEY}}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        bodyParameters: {
          parameters: [
            { name: "sessionId", value: "={{$node['Format Message'].json.sessionId}}" },
            { name: "to", value: "={{$node['Format Message'].json.to}}" },
            { name: "message", value: "={{$node['Format Message'].json.message}}" },
          ],
        },
      },
    },
  ],
  connections: {
    "WhatsApp Webhook": {
      main: [[{ node: "Format Message", type: "main", index: 0 }]],
    },
    "Format Message": {
      main: [[{ node: "Send WhatsApp Reply", type: "main", index: 0 }]],
    },
  },
};

// GET /api/n8n-workflow/download
router.get("/download", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const serverUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.APP_URL || "http://localhost:8080";
  
  // Get first admin API key prefix for reference
  const [firstKey] = await db.select().from(apiKeysTable);
  const keyPrefix = firstKey ? `${firstKey.keyPrefix}...` : "YOUR_API_KEY";
  
  const template = JSON.parse(JSON.stringify(N8N_TEMPLATE));
  
  // Add variables hint
  (template as Record<string, unknown>).staticData = {
    SERVER_URL: serverUrl,
    API_KEY: `REPLACE_WITH_YOUR_API_KEY (prefix: ${keyPrefix})`,
  };
  (template as Record<string, unknown>)._comment = `Import this file into n8n. Set SERVER_URL=${serverUrl} and API_KEY to your actual key.`;
  
  res.setHeader("Content-Disposition", "attachment; filename=n8n-workflow.json");
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(template, null, 2));
});

export default router;
