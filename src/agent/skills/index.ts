/**
 * Skills Index
 *
 * Import this file anywhere to ensure all skills are registered
 * into the skill registry. The side-effect imports trigger registration.
 */

// Run side-effect imports to register all skills
import "./color-grade-skills";
import "./typography-skills";
import "./background-skills";

// Re-export registry utilities for convenience
export {
  listSkills,
  applySkill,
  getSkill,
  registerSkill,
} from "./skill-registry";
export type { Skill, SkillMeta, SkillCategory, SkillParameter } from "./skill-registry";
