import { Router, type IRouter } from "express";
import {
  OptimizeSemesterBody,
  OptimizeSemesterResponse,
  SimulateSemesterBody,
  SimulateSemesterResponse,
} from "@workspace/api-zod";
import { optimizeSemester } from "../lib/optimizer";
import { simulateSemester } from "../lib/simulation";

const router: IRouter = Router();

router.post("/simulate", (req, res) => {
  const parsed = SimulateSemesterBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Please check the semester inputs and try again." });
    return;
  }

  const data = SimulateSemesterResponse.parse(simulateSemester(parsed.data));
  res.json(data);
});

router.post("/optimize", (req, res) => {
  const parsed = OptimizeSemesterBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Please check the semester inputs and try again." });
    return;
  }

  const data = OptimizeSemesterResponse.parse(optimizeSemester(parsed.data));
  res.json(data);
});

export default router;