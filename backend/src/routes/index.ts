import { Router } from "express";
import { adminUsersRouter } from "./adminUsers.routes.js";
import { applicationsRouter } from "./applications.routes.js";
import { auditLogsRouter } from "./auditLogs.routes.js";
import { authRouter } from "./auth.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { healthRouter } from "./health.routes.js";
import { jeevamitraRouter } from "./jeevamitra.routes.js";
import { pasumithraRouter } from "./pasumithra.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin-users", adminUsersRouter);
apiRouter.use("/applications", applicationsRouter);
apiRouter.use("/audit-logs", auditLogsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/pasumithra", pasumithraRouter);
apiRouter.use("/jeevamitra", jeevamitraRouter);
