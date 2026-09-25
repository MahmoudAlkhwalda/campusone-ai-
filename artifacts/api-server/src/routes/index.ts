import { Router, type IRouter } from "express";
import healthRouter from "./health";
import simulationRouter from "./simulation";
import copilotRouter from "./copilot";
import opportunitiesRouter from "./opportunities";
import authRouter from "./auth";

const router: IRouter = Router();
router.use(healthRouter);
router.use(simulationRouter);
router.use(copilotRouter);
router.use(opportunitiesRouter);
router.use(authRouter);
export default router;
