import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import sessionRoutes from "./sessions.js";
import sendRoutes from "./send.js";
import dashboardRoutes from "./dashboard.js";
import apiKeyRoutes from "./api-keys.js";
import chatRoutes from "./chat.js";
import contentRoutes from "./content.js";
import resourcesRoutes from "./resources.js";
import adminRoutes from "./admin.js";
import webhookRoutes from "./telegram.js";
import n8nRoutes from "./n8n.js";
import learnRoutes from "./learn.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/sessions", sessionRoutes);
router.use("/send", sendRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/api-keys", apiKeyRoutes);
router.use("/chat", chatRoutes);
router.use("/content", contentRoutes);
router.use("/resources", resourcesRoutes);
router.use("/admin", adminRoutes);
router.use("/webhook", webhookRoutes);
router.use("/n8n-workflow", n8nRoutes);
router.use("/learn", learnRoutes);

export default router;
