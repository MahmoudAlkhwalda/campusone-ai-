import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, opportunitiesTable } from "@workspace/db";
import {
  MatchOpportunitiesBody,
  MatchOpportunitiesResponse,
} from "@workspace/api-zod";
import { matchOpportunities } from "../lib/opportunities";

const router: IRouter = Router();

const companyOpportunityTypes = new Set([
  "Internship",
  "Paid Internship",
  "Part-Time Job",
  "Graduate Opportunity",
  "Student Program",
]);

function text(value: unknown, label: string, required = true) {
  if (typeof value !== "string" || (required && !value.trim())) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function parseCompanyOpportunity(body: unknown) {
  const input = body as Record<string, unknown>;
  const opportunityType = text(input.opportunityType, "Opportunity type");
  if (!companyOpportunityTypes.has(opportunityType)) throw new Error("Choose a supported opportunity type.");
  const compensationValue = input.compensation === null || input.compensation === "" || input.compensation === undefined
    ? null
    : Number(input.compensation);
  if (compensationValue !== null && (!Number.isFinite(compensationValue) || compensationValue < 0)) {
    throw new Error("Compensation must be a non-negative number.");
  }
  const majorKeywords = text(input.relevantMajors, "Relevant majors", false)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const title = text(input.title, "Opportunity title");
  const companyName = text(input.companyName, "Company name");
  const location = text(input.location, "Location");
  const workMode = text(input.workMode, "Work mode");
  const description = text(input.description, "Description");
  const preferredSkills = text(input.preferredSkills, "Preferred skills", false);
  const duration = text(input.duration, "Duration");
  const deadline = text(input.deadline, "Application deadline");
  const applicationLink = text(input.applicationLink, "Application link", false);
  const id = `company-${randomUUID()}`;
  const today = new Date().toISOString().slice(0, 10);
  const amount = compensationValue === null
    ? "Compensation disclosed by company"
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(compensationValue)} JOD/month`;

  return {
    id,
    name: title,
    provider: companyName,
    sourceUrl: applicationLink || `https://campusone.example/demo-opportunities/${id}`,
    type: "paid-opportunity" as const,
    amount,
    estimatedAmount: compensationValue === null ? null : Math.round(compensationValue),
    deadline,
    requirements: [
      `Description: ${description}`,
      `Location: ${location}`,
      `Work mode: ${workMode}`,
      `Opportunity type: ${opportunityType}`,
      `Relevant majors: ${majorKeywords.length ? majorKeywords.join(", ") : "All majors"}`,
      `Preferred skills: ${preferredSkills || "Not specified"}`,
      `Duration: ${duration}`,
    ],
    verifiedAt: today,
    staleAfterDays: 3650,
    applicationOpensAt: null,
    applicationClosesAt: null,
    isActive: true,
    target: "income" as const,
    majorKeywords,
    institution: null,
    minimumMonths: null,
  };
}

router.post("/opportunities/company", async (req, res, next) => {
  try {
    const opportunity = parseCompanyOpportunity(req.body);
    const [created] = await db.insert(opportunitiesTable).values(opportunity).returning();
    res.status(201).json({ opportunity: created, demo: true });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("required.")) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Choose ")) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Compensation")) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/opportunities/match", async (req, res, next) => {
  const parsed = MatchOpportunitiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please check the support targets and try again." });
    return;
  }
  try {
    const result = await matchOpportunities(parsed.data);
    res.json(MatchOpportunitiesResponse.parse(result));
  } catch (error) {
    next(error);
  }
});

export default router;