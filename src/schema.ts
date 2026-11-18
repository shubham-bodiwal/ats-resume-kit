// Subset of the JSON Resume schema (https://jsonresume.org/schema) that the renderer uses.
// Unknown fields are ignored, so any valid JSON Resume file works.

export interface Location { city?: string; region?: string; countryCode?: string }
export interface Profile { network?: string; username?: string; url?: string }

export interface Basics {
  name?: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: Location;
  profiles?: Profile[];
}

export interface Work {
  name?: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface Project {
  name?: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  keywords?: string[];
}

export interface Education {
  institution?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
}

export interface Skill { name?: string; keywords?: string[] }
export interface Certificate { name?: string; issuer?: string; date?: string }
export interface Language { language?: string; fluency?: string }

export interface Resume {
  basics?: Basics;
  work?: Work[];
  projects?: Project[];
  education?: Education[];
  skills?: Skill[];
  certificates?: Certificate[];
  languages?: Language[];
}

/** Parse and lightly validate a JSON Resume string. Throws a readable error on bad input. */
export function parseResume(json: string): Resume {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(`Resume is not valid JSON: ${(e as Error).message}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Resume must be a JSON object.");
  const r = data as Record<string, unknown>;
  for (const key of ["work", "projects", "education", "skills", "certificates", "languages"]) {
    if (r[key] !== undefined && !Array.isArray(r[key])) throw new Error(`"${key}" must be an array.`);
  }
  return r as Resume;
}
