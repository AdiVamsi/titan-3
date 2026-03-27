import { ResumeProfile } from '@prisma/client';

const DEFAULT_WORK_AUTH =
  'Authorized to work in the U.S. under STEM OPT. No immediate sponsorship required; future employment sponsorship will be needed.';

type ParsedProfile = Omit<
  ResumeProfile,
  'id' | 'createdAt' | 'updatedAt'
>;

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function splitInlineList(value: string) {
  return uniqueStrings(
    value
      .split(',')
      .map((part) => part.replace(/\band\b/gi, '').trim())
      .filter(Boolean),
  );
}

function extractSection(text: string, heading: string, nextHeadings: string[]) {
  const startIndex = text.indexOf(heading);
  if (startIndex === -1) return '';

  const fromHeading = text.slice(startIndex + heading.length).trim();
  let endIndex = fromHeading.length;

  for (const nextHeading of nextHeadings) {
    const nextIndex = fromHeading.indexOf(nextHeading);
    if (nextIndex !== -1 && nextIndex < endIndex) {
      endIndex = nextIndex;
    }
  }

  return fromHeading.slice(0, endIndex).trim();
}

function extractFirstSentence(text: string) {
  const match = text.match(/(.+?[.?!])(\s|$)/);
  return match?.[1]?.trim() || text.trim();
}

function extractCurrentRole(experienceSection: string) {
  const firstLine = experienceSection
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.includes('|'));

  return firstLine?.split('|')[0]?.trim() || null;
}

function extractExperienceYears(summary: string, resumeText: string) {
  const match =
    summary.match(/(\d+(?:\.\d+)?)\+?\s+years/i) ||
    resumeText.match(/(\d+(?:\.\d+)?)\+?\s+years/i);

  return match ? parseFloat(match[1]) : 3;
}

function extractTargetRoles(summary: string) {
  const directMatch = summary.match(/Strong fit for (.+?) roles?/i);
  if (!directMatch) return [];

  return uniqueStrings(
    directMatch[1]
      .replace(/requiring.*$/i, '')
      .split(',')
      .flatMap((part) => part.split('/'))
      .map((part) => part.replace(/\band\b/gi, '').trim()),
  );
}

function extractPreferredLocations(headerLine: string, summary: string) {
  const headerMatches = headerLine
    .split('·')
    .map((part) => part.trim())
    .filter(
      (part) =>
        /remote|relocate|u\.s|usa/i.test(part) ||
        /^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(part),
    );
  const summaryMatches = summary
    .split('.')
    .map((part) => part.trim())
    .filter((part) => /remote|relocate|u\.s|usa/i.test(part));
  const values = uniqueStrings([...headerMatches, ...summaryMatches]);

  return values;
}

function extractRemotePreference(text: string) {
  if (/remote preferred/i.test(text)) return 'remote_preferred';
  if (/open to relocate/i.test(text)) return 'remote_or_relocate';
  if (/remote/i.test(text)) return 'remote_friendly';
  return null;
}

function extractWorkAuthorization(text: string) {
  const match = text.match(/Work Authorization:\s*(.+)/i);
  return match?.[1]?.trim() || DEFAULT_WORK_AUTH;
}

function extractSkills(skillsSection: string) {
  const lines = skillsSection
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let allSkills: string[] = [];
  let aiSkills: string[] = [];
  let backendSkills: string[] = [];

  for (const line of lines) {
    const [rawCategory, rawValues] = line.split(':');
    if (!rawValues) continue;

    const category = rawCategory.toLowerCase();
    const values = splitInlineList(rawValues);
    allSkills = allSkills.concat(values);

    if (category.includes('ai')) {
      aiSkills = aiSkills.concat(values);
    }

    if (
      category.includes('backend') ||
      category.includes('languages') ||
      category.includes('database') ||
      category.includes('cloud')
    ) {
      backendSkills = backendSkills.concat(values);
    }
  }

  const skills = uniqueStrings(allSkills);
  const normalizedAISkills = uniqueStrings(aiSkills);
  const normalizedBackendSkills = uniqueStrings(backendSkills);

  return {
    skills,
    aiSkills: normalizedAISkills,
    backendSkills: normalizedBackendSkills,
    coreSkills: uniqueStrings([...normalizedBackendSkills, ...skills.slice(0, 8)]),
    preferredSkills: normalizedAISkills,
  };
}

function extractProjects(projectsSection: string) {
  const lines = projectsSection
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const projects: string[] = [];
  let currentProject = '';

  for (const line of lines) {
    if (line.startsWith('↗')) {
      continue;
    }

    if (line.includes('·') && !line.startsWith('•')) {
      if (currentProject) {
        projects.push(currentProject);
      }
      currentProject = line.split('·')[0].trim();
      continue;
    }

    if (line.startsWith('•') || line.startsWith('-')) {
      const detail = line.replace(/^[•-]\s*/, '').trim();
      currentProject = currentProject
        ? `${currentProject}: ${detail}`
        : detail;
    }
  }

  if (currentProject) {
    projects.push(currentProject);
  }

  return uniqueStrings(projects).slice(0, 6);
}

export function parseResumeProfile(resumeText: string): ParsedProfile {
  const normalizedText = resumeText.replace(/\r\n/g, '\n').trim();
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean);
  const headerLine = lines[1] || '';
  const fullName = lines[0] || null;

  const summary = extractSection(normalizedText, 'PROFESSIONAL SUMMARY', [
    'TECHNICAL SKILLS',
    'PROFESSIONAL EXPERIENCE',
    'SELECTED PROJECTS',
    'EDUCATION',
  ]);
  const skillsSection = extractSection(normalizedText, 'TECHNICAL SKILLS', [
    'PROFESSIONAL EXPERIENCE',
    'SELECTED PROJECTS',
    'EDUCATION',
    'CERTIFICATIONS',
  ]);
  const experienceSection = extractSection(normalizedText, 'PROFESSIONAL EXPERIENCE', [
    'SELECTED PROJECTS',
    'EDUCATION',
    'CERTIFICATIONS',
  ]);
  const projectsSection = extractSection(normalizedText, 'SELECTED PROJECTS', [
    'EDUCATION',
    'CERTIFICATIONS',
    'Work Authorization:',
  ]);

  const extractedSkills = extractSkills(skillsSection);
  const targetTitles = extractTargetRoles(summary);
  const preferredLocations = extractPreferredLocations(headerLine, summary);

  return {
    label: 'primary',
    fullName,
    headline: extractFirstSentence(summary) || null,
    summary: summary || null,
    currentRole: extractCurrentRole(experienceSection),
    rawResumeText: normalizedText,
    skills: extractedSkills.skills,
    aiSkills: extractedSkills.aiSkills,
    backendSkills: extractedSkills.backendSkills,
    projects: extractProjects(projectsSection),
    targetTitles,
    coreSkills: extractedSkills.coreSkills,
    preferredSkills: extractedSkills.preferredSkills,
    experienceYears: extractExperienceYears(summary, normalizedText),
    workAuth: extractWorkAuthorization(normalizedText),
    locationPref: preferredLocations.join(' | ') || null,
    preferredLocations,
    remotePreference: extractRemotePreference(normalizedText),
    notes: null,
  };
}
