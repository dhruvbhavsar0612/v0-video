/**
 * Skill Registry
 *
 * A "skill" is a parameterized composite editing macro — a higher-order
 * operation that wraps multiple lower-level schema mutations into a single
 * named, documented action the agent can invoke.
 *
 * Two agent tools expose the registry:
 *   list_skills(category?)  → SkillMeta[]
 *   apply_skill(skillId, params) → updated VideoProject
 */

import type { VideoProject } from "@/lib/schema/video-schema";

// ─── Types ───────────────────────────────────────────────────────────

export type SkillCategory =
  | "color-grade"
  | "typography"
  | "background"
  | "layout"
  | "effects";

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean" | "string[]";
  description: string;
  required: boolean;
  default?: unknown;
}

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  parameters: SkillParameter[];
}

export interface Skill extends SkillMeta {
  apply(
    project: VideoProject,
    params: Record<string, unknown>
  ): VideoProject | Promise<VideoProject>;
}

// ─── Registry ────────────────────────────────────────────────────────

const registry = new Map<string, Skill>();

export function registerSkill(skill: Skill): void {
  registry.set(skill.id, skill);
}

export function getSkill(id: string): Skill | undefined {
  return registry.get(id);
}

/**
 * List all registered skills, optionally filtered by category.
 */
export function listSkills(category?: SkillCategory): SkillMeta[] {
  const skills = [...registry.values()];
  const filtered = category ? skills.filter((s) => s.category === category) : skills;
  // Return metadata only (no apply function)
  return filtered.map(({ id, name, description, category: cat, parameters }) => ({
    id,
    name,
    description,
    category: cat,
    parameters,
  }));
}

/**
 * Apply a skill by ID, returning the mutated project.
 */
export async function applySkill(
  skillId: string,
  project: VideoProject,
  params: Record<string, unknown>
): Promise<VideoProject> {
  const skill = registry.get(skillId);
  if (!skill) {
    throw new Error(`Unknown skill: "${skillId}". Use list_skills to see available skills.`);
  }
  return skill.apply(project, params);
}
