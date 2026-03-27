/**
 * Strategic job scoring engine
 * Evaluates direct fit, growth fit, priority, and risk against the saved candidate profile.
 */

import { ScoreBreakdown } from './types';
import { CANDIDATE_PROFILE } from './profile';

export interface ScoringProfile {
  targetTitles: string[];
  coreSkills: string[];
  preferredSkills: string[];
  aiSkills: string[];
  backendSkills: string[];
  experienceYears: number;
  seniorityLevel: string;
  workAuth: string;
  locationPref: string;
  currentRole?: string | null;
  preferredLocations?: string[];
  remotePreference?: string | null;
  skills?: string[];
  projects?: string[];
  headline?: string | null;
  summary?: string | null;
  rawResumeText?: string | null;
}

export type SponsorshipAnalysis = {
  score: number;
  negativeSignals: string[];
  positiveSignals: string[];
  requiresFutureSponsorship: boolean;
};

type RoleFamilyKey =
  | 'AI_GENAI'
  | 'BACKEND_PLATFORM'
  | 'SOFTWARE_GENERALIST'
  | 'ADJACENT_GROWTH'
  | 'LOW_RELEVANCE';

type RoleFamilyConfig = {
  key: RoleFamilyKey;
  label: string;
  strategicBias: number;
  titleSignals: string[];
  textSignals: string[];
  coreSkills: string[];
  secondarySkills: string[];
  incidentalSkills: string[];
  anchorSkills: string[];
};

type RoleFamilyMatch = {
  key: RoleFamilyKey;
  label: string;
  confidence: number;
};

type SkillEvaluation = {
  matchedCoreSkills: string[];
  missingCoreSkills: string[];
  matchedSecondarySkills: string[];
  missingSecondarySkills: string[];
  incidentalMismatches: string[];
  matchedSkills: string[];
  missingSkills: string[];
  keywordGaps: string[];
  coreFitScore: number;
  secondaryFitScore: number;
};

type RealismAnalysis = {
  titleRealism: number;
  seniorityRealism: number;
  leadershipRealism: number;
  overallRealism: number;
  fitCap: number;
  priorityCap: number;
  recommendationCeiling: string;
  requiredYears: number | null;
  yearsGap: number;
  blockingReasons: string[];
  cautionReasons: string[];
};

const SCORE_WEIGHTS = {
  fitScore: {
    familyAlignment: 0.3,
    coreFit: 0.32,
    seniorityFit: 0.14,
    positionability: 0.14,
    growthFit: 0.1,
  },
  priorityScore: {
    strategicAlignment: 0.38,
    fitScore: 0.28,
    positionability: 0.2,
    growthFit: 0.14,
  },
};

const NEGATIVE_SPONSORSHIP_SIGNALS = [
  'no sponsorship',
  'no visa sponsorship',
  'sponsorship not available',
  'no sponsorship available',
  'must be authorized without sponsorship',
  'must be legally authorized to work without sponsorship',
  'must be authorized to work without sponsorship',
  'must be authorized to work in the u s without sponsorship',
  'must be authorized to work in the us without sponsorship',
  'no employer sponsorship',
  'employer sponsorship not available',
  'cannot sponsor',
  'cannot provide sponsorship',
  'unable to sponsor',
  'will not sponsor',
];

const POSITIVE_SPONSORSHIP_SIGNALS = [
  'visa sponsorship available',
  'sponsorship available',
  'will sponsor',
  'can sponsor',
  'open to sponsorship',
  'h1b transfer available',
];

const FRONTEND_HEAVY_SIGNALS = [
  'frontend',
  'front end',
  'ui engineer',
  'ux engineer',
  'react native',
  'ios',
  'android',
  'mobile engineer',
  'visual design',
  'design systems',
];

const LEADERSHIP_SIGNALS = [
  'staff engineer',
  'principal engineer',
  'director',
  'head of',
  'vp engineering',
  'vice president',
  'engineering manager',
  'architect',
];

const EXECUTIVE_TITLE_SIGNALS = [
  'vice president',
  'vp ',
  'vp,',
  'vp of',
  'director',
  'head of',
];

const VERY_SENIOR_TITLE_SIGNALS = [
  'principal engineer',
  'principal software engineer',
  'principal backend engineer',
  'principal ai engineer',
  'staff engineer',
  'senior staff',
  'distinguished',
  'fellow',
];

const MANAGEMENT_TITLE_SIGNALS = [
  'engineering manager',
  'manager',
  'people manager',
];

const LEAD_TITLE_SIGNALS = [
  'tech lead',
  'technical lead',
  'lead engineer',
  'lead software engineer',
  'lead developer',
];

const ARCHITECT_TITLE_SIGNALS = [
  'architect',
  'solution architect',
  'enterprise architect',
  'software architect',
];

const LEADERSHIP_SCOPE_SIGNALS = [
  'mentor',
  'mentoring',
  'coach',
  'coaching',
  'team guidance',
  'guide and influence others',
  'guide others',
  'influence others',
  'org influence',
  'cross functional leadership',
  'technical leadership',
  'define strategy',
  'directional strategy',
  'strategy ownership',
  'architecture governance',
  'architectural governance',
  'escalation management',
  'risk management',
  'recognized authority',
  'organizational influence',
  'stakeholder management',
  'leadership',
  'roadmap ownership',
  'governance',
  'people management',
  'build and lead',
];

const PROGRESSIVE_EXPERIENCE_SIGNALS = [
  'progressive software engineering experience',
  'progressive engineering experience',
  'progressively responsible',
];

const SKILL_ALIASES: Record<string, string[]> = {
  Python: ['python'],
  Java: ['java', 'java 8', 'java 11', 'java se'],
  JavaScript: ['javascript', 'node js', 'nodejs'],
  'REST APIs': ['rest api', 'rest apis', 'api integration', 'api integrations'],
  'API Integration': ['api integration', 'integration layer', 'integrate systems'],
  'Backend Systems': [
    'backend',
    'backend service',
    'backend services',
    'service design',
    'distributed systems',
    'production systems',
  ],
  'SQL / Databases': [
    'sql',
    'database',
    'databases',
    'postgresql',
    'mysql',
    'prisma',
  ],
  LLMs: ['llm', 'llms', 'llm api', 'llm apis', 'large language model'],
  GenAI: ['genai', 'generative ai', 'applied ai'],
  RAG: ['rag', 'retrieval augmented generation'],
  Embeddings: ['embedding', 'embeddings'],
  'Vector Search': ['vector search', 'vector database', 'vector databases'],
  'Workflow Orchestration': [
    'workflow orchestration',
    'orchestration',
    'workflow',
    'agentic workflows',
    'workflow automation',
  ],
  'AI Automation': [
    'ai automation',
    'automation pipeline',
    'automation pipelines',
    'ai workflow automation',
    'advisor assistance',
  ],
  'Software Engineering Fundamentals': [
    'software engineer',
    'software engineering',
    'production software',
    'testing',
    'system design',
    'scalable systems',
  ],
  Microservices: ['microservices', 'microservice'],
  'Cloud / Platform': [
    'aws',
    'cloud',
    'platform',
    'docker',
    'containers',
    'deployment',
    'ci cd',
    'cicd',
    'kubernetes',
  ],
  Observability: ['observability', 'monitoring', 'telemetry', 'logging'],
  'Async Patterns': ['async', 'asynchronous', 'concurrency', 'parallelism'],
  'Spring Boot': ['spring boot'],
  'Hibernate/JPA': ['hibernate', 'jpa', 'hibernate jpa'],
  Go: [' go ', 'golang'],
  TypeScript: ['typescript'],
  LangChain: ['langchain', 'lang chain'],
  LangGraph: ['langgraph', 'lang graph'],
  React: ['react'],
};

const ROLE_FAMILY_CONFIGS: RoleFamilyConfig[] = [
  {
    key: 'AI_GENAI',
    label: 'AI / GenAI / Applied AI',
    strategicBias: 98,
    titleSignals: [
      'ai engineer',
      'applied ai',
      'genai engineer',
      'llm application engineer',
      'ai application engineer',
      'ai automation engineer',
      'software engineer ai',
      'ai platform',
    ],
    textSignals: [
      'llm',
      'genai',
      'rag',
      'embeddings',
      'vector search',
      'prompt engineering',
      'agentic',
      'ai assistant',
      'automation',
      'openai',
      'anthropic',
    ],
    coreSkills: [
      'Python',
      'LLMs',
      'GenAI',
      'RAG',
      'Embeddings',
      'Vector Search',
      'REST APIs',
      'Workflow Orchestration',
      'AI Automation',
    ],
    secondarySkills: [
      'SQL / Databases',
      'Backend Systems',
      'API Integration',
      'Microservices',
      'Java',
      'JavaScript',
      'Cloud / Platform',
      'Async Patterns',
    ],
    incidentalSkills: ['LangChain', 'LangGraph', 'Spring Boot', 'Hibernate/JPA', 'Go'],
    anchorSkills: ['Python', 'LLMs', 'REST APIs'],
  },
  {
    key: 'BACKEND_PLATFORM',
    label: 'Backend / Platform / API Engineering',
    strategicBias: 92,
    titleSignals: [
      'backend engineer',
      'backend software engineer',
      'software engineer backend',
      'platform engineer',
      'api engineer',
      'integration engineer',
      'backend developer',
    ],
    textSignals: [
      'backend',
      'api',
      'service',
      'microservice',
      'platform',
      'integration',
      'database',
      'sql',
      'observability',
    ],
    coreSkills: [
      'Python',
      'REST APIs',
      'SQL / Databases',
      'Backend Systems',
      'API Integration',
      'Software Engineering Fundamentals',
    ],
    secondarySkills: [
      'Java',
      'JavaScript',
      'Microservices',
      'Cloud / Platform',
      'Observability',
      'Async Patterns',
    ],
    incidentalSkills: ['Spring Boot', 'Hibernate/JPA', 'Go', 'TypeScript'],
    anchorSkills: ['REST APIs', 'SQL / Databases', 'Backend Systems'],
  },
  {
    key: 'SOFTWARE_GENERALIST',
    label: 'Software Engineering Generalist',
    strategicBias: 82,
    titleSignals: [
      'software engineer',
      'full stack engineer',
      'product engineer',
      'software developer',
    ],
    textSignals: [
      'backend',
      'api',
      'service',
      'product',
      'distributed systems',
      'scalable systems',
    ],
    coreSkills: [
      'Python',
      'REST APIs',
      'Software Engineering Fundamentals',
      'SQL / Databases',
      'Backend Systems',
    ],
    secondarySkills: [
      'JavaScript',
      'Java',
      'Microservices',
      'API Integration',
      'Cloud / Platform',
    ],
    incidentalSkills: ['React', 'TypeScript', 'Spring Boot', 'Hibernate/JPA'],
    anchorSkills: ['Python', 'REST APIs', 'Software Engineering Fundamentals'],
  },
  {
    key: 'ADJACENT_GROWTH',
    label: 'Adjacent Growth Role',
    strategicBias: 88,
    titleSignals: [
      'ai platform',
      'workflow',
      'orchestration',
      'automation engineer',
      'developer tools',
      'solutions engineer',
      'internal tools',
      'data integration',
    ],
    textSignals: [
      'workflow',
      'automation',
      'orchestration',
      'integration',
      'internal tools',
      'platform',
      'developer productivity',
      'api integration',
      'data ingestion',
    ],
    coreSkills: [
      'Python',
      'REST APIs',
      'Workflow Orchestration',
      'API Integration',
      'Backend Systems',
    ],
    secondarySkills: [
      'LLMs',
      'GenAI',
      'SQL / Databases',
      'Microservices',
      'Cloud / Platform',
      'Observability',
    ],
    incidentalSkills: ['Spring Boot', 'Hibernate/JPA', 'Go', 'TypeScript', 'React'],
    anchorSkills: ['Python', 'REST APIs', 'Workflow Orchestration'],
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(clamp(value));
}

function normalizeForMatch(value: string | null | undefined) {
  return ` ${String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function phraseInText(normalizedText: string, phrase: string) {
  const normalizedPhrase = normalizeForMatch(phrase).trim();
  if (!normalizedPhrase) return false;

  return normalizedText.includes(` ${normalizedPhrase} `);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function getSkillAliases(skill: string) {
  return SKILL_ALIASES[skill] || [skill];
}

function recommendationRank(recommendation: string) {
  switch (recommendation) {
    case 'STRONG_CURRENT_FIT':
      return 4;
    case 'ADJACENT_HIGH_PRIORITY':
      return 3;
    case 'STRETCH_BUT_CREDIBLE':
      return 2;
    case 'LOW_PRIORITY':
      return 1;
    case 'NOT_WORTH_PURSUING':
    default:
      return 0;
  }
}

function applyRecommendationCeiling(
  recommendation: string,
  ceiling: string,
) {
  return recommendationRank(recommendation) > recommendationRank(ceiling)
    ? ceiling
    : recommendation;
}

function hasSkill(text: string, skill: string) {
  return getSkillAliases(skill).some((alias) => phraseInText(text, alias));
}

function detectMentionedSkills(text: string, skills: string[]) {
  return uniqueStrings(skills.filter((skill) => hasSkill(text, skill)));
}

function buildProfileText(profile: ScoringProfile) {
  return normalizeForMatch(
    [
      profile.currentRole,
      profile.headline,
      profile.summary,
      profile.rawResumeText,
      ...(profile.targetTitles || []),
      ...(profile.skills || []),
      ...(profile.coreSkills || []),
      ...(profile.preferredSkills || []),
      ...(profile.aiSkills || []),
      ...(profile.backendSkills || []),
      ...(profile.projects || []),
    ].join(' '),
  );
}

function classifyRoleFamily(
  title: string,
  rawText: string,
): RoleFamilyMatch {
  const normalizedTitle = normalizeForMatch(title);
  const normalizedText = normalizeForMatch(`${title} ${rawText}`);
  const frontendHits = FRONTEND_HEAVY_SIGNALS.filter((signal) =>
    phraseInText(normalizedText, signal),
  ).length;

  const familyScores = ROLE_FAMILY_CONFIGS.map((config) => {
    const titleHits = config.titleSignals.filter((signal) =>
      phraseInText(normalizedTitle, signal),
    ).length;
    const textHits = config.textSignals.filter((signal) =>
      phraseInText(normalizedText, signal),
    ).length;
    const anchorHits = config.anchorSkills.filter((skill) =>
      hasSkill(normalizedText, skill),
    ).length;

    return {
      config,
      score: titleHits * 22 + textHits * 7 + anchorHits * 6,
    };
  }).sort((left, right) => right.score - left.score);

  const best = familyScores[0];

  if (!best || best.score < 20 || (frontendHits > 0 && best.score < 40)) {
    return {
      key: 'LOW_RELEVANCE',
      label: 'Low Relevance',
      confidence: clamp(frontendHits > 0 ? 80 : 55),
    };
  }

  return {
    key: best.config.key,
    label: best.config.label,
    confidence: clamp(35 + best.score),
  };
}

function getRoleFamilyConfig(roleFamily: RoleFamilyKey) {
  return (
    ROLE_FAMILY_CONFIGS.find((config) => config.key === roleFamily) || {
      key: 'LOW_RELEVANCE' as const,
      label: 'Low Relevance',
      strategicBias: 25,
      titleSignals: [],
      textSignals: [],
      coreSkills: [],
      secondarySkills: [],
      incidentalSkills: [],
      anchorSkills: [],
    }
  );
}

function evaluateSkillFit(
  roleFamily: RoleFamilyMatch,
  rawText: string,
  profile: ScoringProfile,
): SkillEvaluation {
  const roleConfig = getRoleFamilyConfig(roleFamily.key);
  const normalizedJobText = normalizeForMatch(rawText);
  const profileText = buildProfileText(profile);

  let requiredCoreSkills = detectMentionedSkills(normalizedJobText, roleConfig.coreSkills);
  if (requiredCoreSkills.length < 2) {
    requiredCoreSkills = uniqueStrings([
      ...requiredCoreSkills,
      ...roleConfig.anchorSkills,
    ]);
  }

  const requiredSecondarySkills = detectMentionedSkills(
    normalizedJobText,
    roleConfig.secondarySkills,
  );
  const incidentalSkills = detectMentionedSkills(
    normalizedJobText,
    roleConfig.incidentalSkills,
  );

  const matchedCoreSkills = requiredCoreSkills.filter((skill) =>
    hasSkill(profileText, skill),
  );
  const missingCoreSkills = requiredCoreSkills.filter(
    (skill) => !hasSkill(profileText, skill),
  );
  const matchedSecondarySkills = requiredSecondarySkills.filter((skill) =>
    hasSkill(profileText, skill),
  );
  const missingSecondarySkills = requiredSecondarySkills.filter(
    (skill) => !hasSkill(profileText, skill),
  );
  const incidentalMismatches = incidentalSkills.filter(
    (skill) => !hasSkill(profileText, skill),
  );

  const coreCoverage =
    requiredCoreSkills.length > 0
      ? matchedCoreSkills.length / requiredCoreSkills.length
      : roleFamily.confidence >= 75
      ? 0.8
      : 0.65;
  const secondaryCoverage =
    requiredSecondarySkills.length > 0
      ? matchedSecondarySkills.length / requiredSecondarySkills.length
      : 0.75;

  const coreFitScore = clamp(
    35 + coreCoverage * 55 - missingCoreSkills.length * 5 + roleFamily.confidence * 0.08,
  );
  const secondaryFitScore = clamp(
    55 + secondaryCoverage * 30 - missingSecondarySkills.length * 2 - incidentalMismatches.length,
  );

  return {
    matchedCoreSkills,
    missingCoreSkills,
    matchedSecondarySkills,
    missingSecondarySkills,
    incidentalMismatches,
    matchedSkills: uniqueStrings([...matchedCoreSkills, ...matchedSecondarySkills]),
    missingSkills: uniqueStrings([...missingCoreSkills, ...missingSecondarySkills]),
    keywordGaps: incidentalMismatches,
    coreFitScore,
    secondaryFitScore,
  };
}

function calculateTitleFit(
  title: string,
  roleFamily: RoleFamilyMatch,
  profile: ScoringProfile,
): number {
  const normalizedTitle = normalizeForMatch(title);
  const targetTitleHits = (profile.targetTitles || []).filter((targetTitle) =>
    phraseInText(normalizedTitle, targetTitle),
  ).length;
  const currentRoleMatch = profile.currentRole
    ? phraseInText(normalizedTitle, profile.currentRole)
    : false;

  return clamp(
    roleFamily.confidence * 0.65 +
      targetTitleHits * 12 +
      (currentRoleMatch ? 10 : 0),
  );
}

function extractRequiredYears(text: string) {
  const lowerText = text.toLowerCase();
  const matches: number[] = [];
  const patterns = [
    /(?:minimum of |at least |minimum )?(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d{1,2})?\s+years?[^.\n]{0,40}experience/g,
    /(\d{1,2})\+\s+years?[^.\n]{0,40}experience/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(lowerText)) !== null) {
      const first = Number(match[1] || 0);
      const second = Number(match[2] || 0);
      matches.push(Math.max(first, second));
    }
  }

  if (matches.length === 0) {
    return null;
  }

  return Math.max(...matches);
}

function analyzeRoleRealism(
  title: string,
  text: string,
  profile: ScoringProfile,
): RealismAnalysis {
  const normalizedTitle = normalizeForMatch(title);
  const normalizedText = normalizeForMatch(`${title} ${text}`);
  const experienceYears = profile.experienceYears || 0;
  const requiredYears = extractRequiredYears(`${title}\n${text}`);
  const yearsGap =
    requiredYears !== null ? Math.max(0, requiredYears - experienceYears) : 0;

  const executiveTitleHits = EXECUTIVE_TITLE_SIGNALS.filter((signal) =>
    phraseInText(normalizedTitle, signal),
  ).length;
  const verySeniorTitleHits = VERY_SENIOR_TITLE_SIGNALS.filter((signal) =>
    phraseInText(normalizedTitle, signal),
  ).length;
  const managementTitleHits = MANAGEMENT_TITLE_SIGNALS.filter((signal) =>
    phraseInText(normalizedTitle, signal),
  ).length;
  const leadTitleHits = LEAD_TITLE_SIGNALS.filter((signal) =>
    phraseInText(normalizedTitle, signal),
  ).length;
  const architectTitleHits = ARCHITECT_TITLE_SIGNALS.filter((signal) =>
    phraseInText(normalizedTitle, signal),
  ).length;
  const leadershipScopeHits = LEADERSHIP_SCOPE_SIGNALS.filter((signal) =>
    phraseInText(normalizedText, signal),
  ).length;
  const progressiveExperienceHits = PROGRESSIVE_EXPERIENCE_SIGNALS.filter((signal) =>
    phraseInText(normalizedText, signal),
  ).length;

  let titleRealism = 92;
  let seniorityRealism = 88;
  let leadershipRealism = 88;
  let fitCap = 100;
  let priorityCap = 100;
  let recommendationCeiling = 'STRONG_CURRENT_FIT';

  const blockingReasons: string[] = [];
  const cautionReasons: string[] = [];

  const tightenCaps = (
    nextFitCap: number,
    nextPriorityCap: number,
    nextCeiling: string,
  ) => {
    fitCap = Math.min(fitCap, nextFitCap);
    priorityCap = Math.min(priorityCap, nextPriorityCap);
    recommendationCeiling = applyRecommendationCeiling(
      recommendationCeiling,
      nextCeiling,
    );
  };

  if (executiveTitleHits > 0) {
    titleRealism = Math.min(titleRealism, 8);
    seniorityRealism = Math.min(seniorityRealism, 12);
    leadershipRealism = Math.min(leadershipRealism, 10);
    tightenCaps(34, 24, 'NOT_WORTH_PURSUING');
    blockingReasons.push('executive title scope');
  }

  if (verySeniorTitleHits > 0) {
    titleRealism = Math.min(titleRealism, 24);
    seniorityRealism = Math.min(seniorityRealism, 26);
    leadershipRealism = Math.min(leadershipRealism, 26);
    tightenCaps(52, 42, 'STRETCH_BUT_CREDIBLE');
    blockingReasons.push('very senior title expectations');
  }

  if (managementTitleHits > 0) {
    titleRealism = Math.min(titleRealism, 22);
    seniorityRealism = Math.min(seniorityRealism, 24);
    leadershipRealism = Math.min(leadershipRealism, 18);
    tightenCaps(45, 36, 'LOW_PRIORITY');
    blockingReasons.push('people-management scope');
  }

  if (leadTitleHits > 0) {
    titleRealism = Math.min(titleRealism, leadershipScopeHits >= 2 ? 42 : 55);
    leadershipRealism = Math.min(
      leadershipRealism,
      leadershipScopeHits >= 2 ? 36 : 50,
    );
    tightenCaps(60, 52, 'STRETCH_BUT_CREDIBLE');
    cautionReasons.push('lead-level ownership expectations');
  }

  if (architectTitleHits > 0) {
    titleRealism = Math.min(titleRealism, leadershipScopeHits >= 2 ? 34 : 52);
    leadershipRealism = Math.min(
      leadershipRealism,
      leadershipScopeHits >= 2 ? 28 : 48,
    );
    tightenCaps(58, 48, 'STRETCH_BUT_CREDIBLE');
    cautionReasons.push(
      leadershipScopeHits >= 2
        ? 'architect role appears governance-heavy'
        : 'architect title may expect broader design ownership',
    );
  }

  if (requiredYears !== null && yearsGap > 0) {
    if (requiredYears >= 8 && yearsGap >= 5) {
      seniorityRealism = Math.min(seniorityRealism, 16);
      leadershipRealism = Math.min(leadershipRealism, 22);
      tightenCaps(38, 28, 'NOT_WORTH_PURSUING');
      blockingReasons.push(`required experience is ${requiredYears}+ years`);
    } else if (requiredYears >= 6 && yearsGap >= 3) {
      seniorityRealism = Math.min(seniorityRealism, 28);
      leadershipRealism = Math.min(leadershipRealism, 34);
      tightenCaps(50, 40, 'STRETCH_BUT_CREDIBLE');
      blockingReasons.push(`years-of-experience gap (${requiredYears}+ years required)`);
    } else if (yearsGap >= 2) {
      seniorityRealism = Math.min(seniorityRealism, 54);
      tightenCaps(66, 58, 'STRETCH_BUT_CREDIBLE');
      cautionReasons.push(`experience ask is above the current profile (${requiredYears}+ years)`);
    }
  }

  if (progressiveExperienceHits > 0) {
    seniorityRealism = Math.min(seniorityRealism, 34);
    leadershipRealism = Math.min(leadershipRealism, 38);
    tightenCaps(56, 46, 'STRETCH_BUT_CREDIBLE');
    blockingReasons.push('progressive experience expectation');
  }

  if (leadershipScopeHits >= 5) {
    leadershipRealism = Math.min(leadershipRealism, 18);
    seniorityRealism = Math.min(seniorityRealism, 24);
    tightenCaps(46, 34, 'LOW_PRIORITY');
    blockingReasons.push('leadership-heavy scope');
  } else if (leadershipScopeHits >= 3) {
    leadershipRealism = Math.min(leadershipRealism, 34);
    tightenCaps(58, 48, 'STRETCH_BUT_CREDIBLE');
    cautionReasons.push('ownership expectations run above a typical early-career scope');
  } else if (leadershipScopeHits >= 1) {
    leadershipRealism = Math.min(leadershipRealism, 58);
    cautionReasons.push('some leadership/ownership signals are present');
  }

  const overallRealism = clamp(
    titleRealism * 0.34 +
      seniorityRealism * 0.38 +
      leadershipRealism * 0.28,
  );

  return {
    titleRealism,
    seniorityRealism,
    leadershipRealism,
    overallRealism,
    fitCap,
    priorityCap,
    recommendationCeiling,
    requiredYears,
    yearsGap,
    blockingReasons: uniqueStrings(blockingReasons),
    cautionReasons: uniqueStrings(cautionReasons),
  };
}

function calculateSeniorityFit(text: string, title: string, profile: ScoringProfile): number {
  const normalizedText = normalizeForMatch(`${title} ${text}`);
  const years = profile.experienceYears || 0;
  const leadershipHits = LEADERSHIP_SIGNALS.filter((signal) =>
    phraseInText(normalizedText, signal),
  ).length;

  if (leadershipHits > 0) {
    return clamp(years >= 6 ? 55 : 25);
  }

  const staffSignals = ['staff', 'principal', 'director', 'head of'];
  if (staffSignals.some((signal) => phraseInText(normalizedText, signal))) {
    return years >= 6 ? 50 : 20;
  }

  if (phraseInText(normalizedText, 'senior') || phraseInText(normalizedText, 'lead')) {
    return years >= 5 ? 72 : years >= 3 ? 58 : 42;
  }

  if (
    phraseInText(normalizedText, 'mid') ||
    phraseInText(normalizedText, 'intermediate') ||
    phraseInText(normalizedText, '3 5 years') ||
    phraseInText(normalizedText, '4 years')
  ) {
    return years >= 3 ? 92 : 72;
  }

  if (
    phraseInText(normalizedText, 'junior') ||
    phraseInText(normalizedText, 'entry level') ||
    phraseInText(normalizedText, 'entry')
  ) {
    return years >= 3 ? 72 : 84;
  }

  return years >= 3 ? 82 : 70;
}

function calculateStrategicAlignment(
  roleFamily: RoleFamilyMatch,
  titleFit: number,
  relevantProjects: string[],
): number {
  const roleConfig = getRoleFamilyConfig(roleFamily.key);

  return clamp(
    roleConfig.strategicBias * 0.5 +
      titleFit * 0.3 +
      (relevantProjects.length > 0 ? 12 : 0) +
      roleFamily.confidence * 0.12,
  );
}

function calculateGrowthPotential(
  roleFamily: RoleFamilyMatch,
  skillEvaluation: SkillEvaluation,
): number {
  if (roleFamily.key === 'LOW_RELEVANCE') {
    return 18;
  }

  const strongCoreBase = skillEvaluation.matchedCoreSkills.length >= 2 ? 74 : 58;
  const missingCorePenalty = skillEvaluation.missingCoreSkills.length * 7;
  const secondaryPenalty = skillEvaluation.missingSecondarySkills.length * 2;

  return clamp(
    strongCoreBase +
      roleFamily.confidence * 0.18 -
      missingCorePenalty -
      secondaryPenalty,
  );
}

function calculatePositionability(
  profile: ScoringProfile,
  roleFamily: RoleFamilyMatch,
  skillEvaluation: SkillEvaluation,
  seniorityFit: number,
  relevantProjects: string[],
): number {
  const currentRoleBoost = profile.currentRole ? 8 : 0;
  const projectBoost = Math.min(12, relevantProjects.length * 6);

  return clamp(
    roleFamily.confidence * 0.2 +
      skillEvaluation.coreFitScore * 0.38 +
      seniorityFit * 0.24 +
      currentRoleBoost +
      projectBoost -
      skillEvaluation.missingCoreSkills.length * 6,
  );
}

function calculateLocationFit(
  location: string | null | undefined,
  profile: ScoringProfile,
): number {
  const preferredLocations = (profile.preferredLocations || []).map((value) =>
    value.toLowerCase(),
  );
  const remotePreference = (profile.remotePreference || '').toLowerCase();
  const lowerPreference = (profile.locationPref || '').toLowerCase();

  if (!location) {
    return lowerPreference.includes('remote') || remotePreference.includes('remote')
      ? 90
      : 72;
  }

  const normalizedLocation = normalizeForMatch(location);

  if (
    phraseInText(normalizedLocation, 'remote') ||
    phraseInText(normalizedLocation, 'distributed') ||
    phraseInText(normalizedLocation, 'anywhere')
  ) {
    return 100;
  }

  if (preferredLocations.some((preferredLocation) => phraseInText(normalizedLocation, preferredLocation))) {
    return 95;
  }

  if (
    lowerPreference &&
    (phraseInText(normalizedLocation, lowerPreference) ||
      normalizeForMatch(lowerPreference).includes(normalizedLocation.trim()))
  ) {
    return 90;
  }

  if (
    phraseInText(normalizedLocation, 'united states') ||
    phraseInText(normalizedLocation, 'usa') ||
    phraseInText(normalizedLocation, 'us')
  ) {
    return 82;
  }

  return 45;
}

function requiresFutureSponsorship(profile: ScoringProfile) {
  const lowerWorkAuth = (profile.workAuth || '').toLowerCase();

  return (
    lowerWorkAuth.includes('future employment sponsorship will be needed') ||
    lowerWorkAuth.includes('future sponsorship will be needed') ||
    lowerWorkAuth.includes('stem opt') ||
    lowerWorkAuth.includes('opt')
  );
}

export function analyzeSponsorshipSignals(
  text: string,
  profile: ScoringProfile,
): SponsorshipAnalysis {
  const normalizedText = normalizeForMatch(text);
  const needsFutureSponsorship = requiresFutureSponsorship(profile);
  const negativeSignals = NEGATIVE_SPONSORSHIP_SIGNALS.filter((signal) =>
    phraseInText(normalizedText, signal),
  );
  const positiveSignals = POSITIVE_SPONSORSHIP_SIGNALS.filter((signal) =>
    phraseInText(normalizedText, signal),
  );
  const hasGenericVisaConstraint =
    phraseInText(normalizedText, 'sponsorship required') ||
    phraseInText(normalizedText, 'visa sponsorship') ||
    phraseInText(normalizedText, 'work visa') ||
    phraseInText(normalizedText, 'h1b');

  if (negativeSignals.length > 0 && needsFutureSponsorship) {
    return {
      score: 10,
      negativeSignals,
      positiveSignals,
      requiresFutureSponsorship: true,
    };
  }

  if (negativeSignals.length > 0) {
    return {
      score: 35,
      negativeSignals,
      positiveSignals,
      requiresFutureSponsorship: needsFutureSponsorship,
    };
  }

  if (positiveSignals.length > 0) {
    return {
      score: needsFutureSponsorship ? 82 : 92,
      negativeSignals,
      positiveSignals,
      requiresFutureSponsorship: needsFutureSponsorship,
    };
  }

  if (needsFutureSponsorship) {
    return {
      score: hasGenericVisaConstraint ? 60 : 76,
      negativeSignals,
      positiveSignals,
      requiresFutureSponsorship: true,
    };
  }

  return {
    score: hasGenericVisaConstraint ? 55 : 72,
    negativeSignals,
    positiveSignals,
    requiresFutureSponsorship: needsFutureSponsorship,
  };
}

function extractRelevantProjects(
  text: string,
  profile: ScoringProfile,
): string[] {
  const normalizedText = normalizeForMatch(text);
  const projectSignals = uniqueStrings([
    ...profile.aiSkills,
    ...profile.backendSkills,
    ...(profile.skills || []),
    'workflow',
    'automation',
    'platform',
    'api',
    'backend',
    'llm',
    'rag',
  ]).filter((signal) => phraseInText(normalizedText, signal));

  return uniqueStrings(
    (profile.projects || []).filter((project) => {
      const normalizedProject = normalizeForMatch(project);
      return projectSignals.some((signal) => phraseInText(normalizedProject, signal));
    }),
  ).slice(0, 3);
}

function buildRiskFlags(
  roleFamily: RoleFamilyMatch,
  skillEvaluation: SkillEvaluation,
  seniorityFit: number,
  sponsorshipAnalysis: SponsorshipAnalysis,
  realismAnalysis: RealismAnalysis,
  text: string,
): { riskFlags: string[]; descriptiveRisks: string[]; riskLevel: string } {
  const normalizedText = normalizeForMatch(text);
  const flags: string[] = [];
  const risks: string[] = [];
  let severity = 0;

  if (sponsorshipAnalysis.negativeSignals.length > 0) {
    flags.push('Sponsorship restriction');
    risks.push(
      sponsorshipAnalysis.requiresFutureSponsorship
        ? 'Posting appears to reject employer sponsorship, which conflicts with the saved STEM OPT / future sponsorship need.'
        : 'Posting includes restrictive sponsorship language.',
    );
    severity += sponsorshipAnalysis.requiresFutureSponsorship ? 3 : 2;
  }

  if (seniorityFit < 45) {
    flags.push('Role too senior');
    risks.push('Role appears substantially above the current experience band.');
    severity += 2;
  } else if (seniorityFit < 65) {
    flags.push('Seniority stretch');
    risks.push('Role may require stretching the resume narrative on level and scope.');
    severity += 1;
  }

  if (realismAnalysis.blockingReasons.length > 0) {
    flags.push('Seniority mismatch');
    risks.push(
      `Primary realism blocker: ${realismAnalysis.blockingReasons
        .slice(0, 2)
        .join(', ')}.`,
    );
    severity += 2;
  }

  if (
    realismAnalysis.leadershipRealism < 40 ||
    realismAnalysis.cautionReasons.some((reason) =>
      reason.toLowerCase().includes('lead'),
    )
  ) {
    flags.push('Leadership mismatch');
    risks.push('Role expects leadership or ownership scope that is above the current profile.');
    severity += realismAnalysis.leadershipRealism < 30 ? 2 : 1;
  }

  if (realismAnalysis.requiredYears && realismAnalysis.yearsGap >= 2) {
    flags.push('Years-of-experience mismatch');
    risks.push(
      `Posting asks for ${realismAnalysis.requiredYears}+ years, which is materially above the current experience band.`,
    );
    severity += realismAnalysis.yearsGap >= 4 ? 2 : 1;
  }

  if (roleFamily.key === 'AI_GENAI' && skillEvaluation.missingCoreSkills.some((skill) =>
    ['LLMs', 'GenAI', 'RAG', 'Embeddings', 'Vector Search'].includes(skill),
  )) {
    flags.push('Missing core AI depth');
    severity += 2;
  }

  if (
    (roleFamily.key === 'BACKEND_PLATFORM' || roleFamily.key === 'SOFTWARE_GENERALIST') &&
    skillEvaluation.missingCoreSkills.some((skill) =>
      ['REST APIs', 'SQL / Databases', 'Backend Systems'].includes(skill),
    )
  ) {
    flags.push('Missing backend fundamentals');
    severity += 2;
  }

  if (skillEvaluation.missingCoreSkills.length >= 3) {
    flags.push('Too many missing core skills');
    severity += 2;
  }

  if (
    FRONTEND_HEAVY_SIGNALS.some((signal) => phraseInText(normalizedText, signal)) &&
    roleFamily.key === 'LOW_RELEVANCE'
  ) {
    flags.push('Frontend-heavy mismatch');
    risks.push('Role appears frontend-led rather than backend / AI aligned.');
    severity += 2;
  }

  if (LEADERSHIP_SIGNALS.some((signal) => phraseInText(normalizedText, signal))) {
    flags.push('Leadership-heavy scope');
    severity += 1;
  }

  const riskLevel =
    severity >= 4 ? 'HIGH' : severity >= 2 ? 'MEDIUM' : 'LOW';

  return {
    riskFlags: uniqueStrings(flags),
    descriptiveRisks: uniqueStrings([
      ...risks,
      ...skillEvaluation.missingCoreSkills
        .slice(0, 4)
        .map((skill) => `Missing or weaker core evidence for ${skill}.`),
      ...skillEvaluation.missingSecondarySkills
        .slice(0, 4)
        .map((skill) => `Secondary stack gap: ${skill}.`),
      ...skillEvaluation.incidentalMismatches
        .slice(0, 3)
        .map((skill) => `Incidental stack mismatch: ${skill}.`),
    ]).slice(0, 8),
    riskLevel,
  };
}

function determinePursuitRecommendation(
  fitScore: number,
  priorityScore: number,
  positionabilityScore: number,
  riskLevel: string,
  roleFamily: RoleFamilyMatch,
): string {
  if (roleFamily.key === 'LOW_RELEVANCE' || priorityScore < 45) {
    return 'NOT_WORTH_PURSUING';
  }

  if (fitScore >= 78 && priorityScore >= 76 && riskLevel !== 'HIGH') {
    return 'STRONG_CURRENT_FIT';
  }

  if (priorityScore >= 72 && positionabilityScore >= 64) {
    return 'ADJACENT_HIGH_PRIORITY';
  }

  if (positionabilityScore >= 58 && fitScore >= 52) {
    return 'STRETCH_BUT_CREDIBLE';
  }

  return 'LOW_PRIORITY';
}

function buildPositionabilityNote(
  roleFamily: RoleFamilyMatch,
  profile: ScoringProfile,
  relevantProjects: string[],
  positionabilityScore: number,
  recommendation: string,
  realismAnalysis: RealismAnalysis,
) {
  const projectNames = uniqueStrings(
    relevantProjects.map((project) => project.split(':')[0]?.trim() || project),
  );
  const roleContext = profile.currentRole
    ? `current ${profile.currentRole}`
    : 'saved candidate profile';

  if (realismAnalysis.blockingReasons.length > 0) {
    return `The stack alignment is real, but the role is not very positionable right now because of ${realismAnalysis.blockingReasons
      .slice(0, 2)
      .join(' and ')}.`;
  }

  if (recommendation === 'STRONG_CURRENT_FIT') {
    return `This looks directly positionable from the ${roleContext}, supported by ${projectNames[0] || 'recent project work'} and aligned role-family evidence.`;
  }

  if (recommendation === 'ADJACENT_HIGH_PRIORITY') {
    return `This is a strong adjacent move: the ${roleContext} plus ${projectNames[0] || 'project work'} create a credible story for ${roleFamily.label.toLowerCase()} roles.`;
  }

  if (recommendation === 'STRETCH_BUT_CREDIBLE') {
    return `This is stretchable but still positionable if the resume leans on ${projectNames.slice(0, 2).join(' and ') || 'relevant projects'} and frames the move as deliberate growth.`;
  }

  if (positionabilityScore < 45) {
    return 'The current profile would require too much reframing to make this application persuasive.';
  }

  return 'This role is only lightly positionable and should be secondary to stronger direct or adjacent fits.';
}

function buildStrategicRationale(
  companyName: string,
  roleFamily: RoleFamilyMatch,
  skillEvaluation: SkillEvaluation,
  relevantProjects: string[],
  fitScore: number,
  priorityScore: number,
  recommendation: string,
  realismAnalysis: RealismAnalysis,
  sponsorshipAnalysis: SponsorshipAnalysis,
  salaryText: string | null | undefined,
): string {
  const strengths =
    skillEvaluation.matchedCoreSkills.length > 0
      ? `Matched core strengths include ${skillEvaluation.matchedCoreSkills.slice(0, 4).join(', ')}.`
      : 'Core-skill overlap is limited.';
  const coreGapText =
    skillEvaluation.missingCoreSkills.length > 0
      ? `Core gaps are ${skillEvaluation.missingCoreSkills.slice(0, 3).join(', ')}.`
      : 'No major core-skill gaps surfaced.';
  const secondaryGapText =
    skillEvaluation.missingSecondarySkills.length > 0
      ? `Missing items are mostly secondary: ${skillEvaluation.missingSecondarySkills
          .slice(0, 4)
          .join(', ')}.`
      : 'Secondary stack gaps are manageable.';
  const incidentalText =
    skillEvaluation.incidentalMismatches.length > 0
      ? `Incidental framework mismatches include ${skillEvaluation.incidentalMismatches
          .slice(0, 3)
          .join(', ')}.`
      : 'No meaningful incidental-stack mismatch surfaced.';
  const projectText =
    relevantProjects.length > 0
      ? `Relevant projects reinforce the story, especially ${relevantProjects
          .map((project) => project.split(':')[0]?.trim() || project)
          .slice(0, 2)
          .join(' and ')}.`
      : 'Project support is lighter, so the story depends more on experience framing.';
  const realismText =
    realismAnalysis.blockingReasons.length > 0
      ? `Strong stack overlap is present, but this is not a realistic target at the current career stage because of ${realismAnalysis.blockingReasons
          .slice(0, 3)
          .join(', ')}.`
      : realismAnalysis.cautionReasons.length > 0
      ? `Realism check: ${realismAnalysis.cautionReasons.slice(0, 2).join(', ')}.`
      : 'The title, seniority, and ownership scope look reasonably realistic for the current search.';
  const recommendationText = {
    STRONG_CURRENT_FIT: 'This is a strong current-fit target and worth active pursuit.',
    ADJACENT_HIGH_PRIORITY:
      'This is an adjacent but strategically strong target and worth pursuing.',
    STRETCH_BUT_CREDIBLE:
      'This is a stretch, but still credible if positioned around trajectory and relevant projects.',
    LOW_PRIORITY: 'This is only a moderate chase candidate and should stay behind stronger fits.',
    NOT_WORTH_PURSUING: 'This is low-value for the current search and should usually be deprioritized.',
  }[recommendation];
  const sponsorshipText =
    sponsorshipAnalysis.negativeSignals.length > 0
      ? `Sponsorship language is a separate blocker: ${sponsorshipAnalysis.negativeSignals
          .slice(0, 2)
          .join(', ')}.`
      : 'No explicit sponsorship blocker was detected in the JD wording.';

  return [
    `Closest role family for ${companyName}: ${roleFamily.label}.`,
    strengths,
    coreGapText,
    secondaryGapText,
    incidentalText,
    realismText,
    projectText,
    `Direct fit is ${fitScore}/100 and strategic priority is ${priorityScore}/100.`,
    recommendationText,
    sponsorshipText,
    salaryText ? `Compensation detail noted: ${salaryText}.` : null,
  ].join(' ');
}

export function scoreJob(
  title: string,
  companyName: string,
  location: string | null | undefined,
  salaryText: string | null | undefined,
  rawText: string,
  profile: ScoringProfile = CANDIDATE_PROFILE,
): ScoreBreakdown {
  const combinedText = `${title}\n${rawText}`;
  const roleFamily = classifyRoleFamily(title, rawText);
  const skillEvaluation = evaluateSkillFit(roleFamily, combinedText, profile);
  const relevantProjects = extractRelevantProjects(combinedText, profile);
  const realismAnalysis = analyzeRoleRealism(title, rawText, profile);
  const titleFit = clamp(
    calculateTitleFit(title, roleFamily, profile) * 0.25 +
      realismAnalysis.titleRealism * 0.75,
  );
  const seniorityFit = clamp(
    calculateSeniorityFit(rawText, title, profile) * 0.3 +
      realismAnalysis.seniorityRealism * 0.7,
  );
  const strategicAlignment = calculateStrategicAlignment(
    roleFamily,
    titleFit,
    relevantProjects,
  );
  const growthFit = calculateGrowthPotential(roleFamily, skillEvaluation);
  const basePositionabilityScore = calculatePositionability(
    profile,
    roleFamily,
    skillEvaluation,
    seniorityFit,
    relevantProjects,
  );
  const positionabilityScore = clamp(
    basePositionabilityScore * 0.55 + realismAnalysis.overallRealism * 0.45,
  );
  const locationFit = calculateLocationFit(location, profile);
  const sponsorshipAnalysis = analyzeSponsorshipSignals(combinedText, profile);
  const realismPenalty = clamp((100 - realismAnalysis.overallRealism) * 0.22, 0, 28);
  const rawFitScore = clamp(
    titleFit * SCORE_WEIGHTS.fitScore.familyAlignment +
      skillEvaluation.coreFitScore * SCORE_WEIGHTS.fitScore.coreFit +
      seniorityFit * SCORE_WEIGHTS.fitScore.seniorityFit +
      positionabilityScore * SCORE_WEIGHTS.fitScore.positionability +
      growthFit * SCORE_WEIGHTS.fitScore.growthFit,
  );
  const fitScore = clamp(
    Math.min(rawFitScore - realismPenalty, realismAnalysis.fitCap),
  );
  const rawPriorityScore = clamp(
    strategicAlignment * SCORE_WEIGHTS.priorityScore.strategicAlignment +
      fitScore * SCORE_WEIGHTS.priorityScore.fitScore +
      positionabilityScore * SCORE_WEIGHTS.priorityScore.positionability +
      growthFit * SCORE_WEIGHTS.priorityScore.growthFit,
  );
  const priorityScore = clamp(
    Math.min(rawPriorityScore - realismPenalty * 1.1, realismAnalysis.priorityCap),
  );
  const riskSummary = buildRiskFlags(
    roleFamily,
    skillEvaluation,
    seniorityFit,
    sponsorshipAnalysis,
    realismAnalysis,
    combinedText,
  );
  const baseRecommendation = determinePursuitRecommendation(
    fitScore,
    priorityScore,
    positionabilityScore,
    riskSummary.riskLevel,
    roleFamily,
  );
  const pursuitRecommendation = applyRecommendationCeiling(
    baseRecommendation,
    realismAnalysis.recommendationCeiling,
  );
  const positionabilityNote = buildPositionabilityNote(
    roleFamily,
    profile,
    relevantProjects,
    positionabilityScore,
    pursuitRecommendation,
    realismAnalysis,
  );
  const strategicRationale = buildStrategicRationale(
    companyName,
    roleFamily,
    skillEvaluation,
    relevantProjects,
    round(fitScore),
    round(priorityScore),
    pursuitRecommendation,
    realismAnalysis,
    sponsorshipAnalysis,
    salaryText,
  );
  const rationale = [
    `Closest role family is ${roleFamily.label}.`,
    skillEvaluation.matchedCoreSkills.length > 0
      ? `Core alignment comes from ${skillEvaluation.matchedCoreSkills
          .slice(0, 4)
          .join(', ')}.`
      : 'Core alignment is limited.',
    skillEvaluation.missingCoreSkills.length > 0
      ? `Critical gaps: ${skillEvaluation.missingCoreSkills.slice(0, 3).join(', ')}.`
      : 'Critical gaps are limited.',
    realismAnalysis.blockingReasons.length > 0
      ? `Real blocker: ${realismAnalysis.blockingReasons.slice(0, 3).join(', ')}.`
      : realismAnalysis.cautionReasons.length > 0
      ? `Main caution: ${realismAnalysis.cautionReasons.slice(0, 2).join(', ')}.`
      : 'Seniority and scope look reasonably realistic.',
    sponsorshipAnalysis.negativeSignals.length > 0
      ? `Sponsorship restrictions detected: ${sponsorshipAnalysis.negativeSignals
          .slice(0, 2)
          .join(', ')}.`
      : null,
  ].filter(Boolean).join(' ');

  return {
    roleFamily: roleFamily.label,
    familyConfidence: round(roleFamily.confidence),
    titleFit: round(titleFit),
    skillsFit: round(skillEvaluation.coreFitScore),
    seniorityFit: round(seniorityFit),
    aiRelevance: round(strategicAlignment),
    backendRelevance: round(growthFit),
    locationFit: round(locationFit),
    sponsorshipRisk: round(sponsorshipAnalysis.score),
    priorityScore: round(priorityScore),
    positionabilityScore: round(positionabilityScore),
    riskLevel: riskSummary.riskLevel,
    pursuitRecommendation,
    overallScore: round(fitScore),
    rationale,
    strategicRationale,
    positionabilityNote,
    riskFlags: riskSummary.riskFlags,
    matchedSkills: skillEvaluation.matchedSkills,
    missingSkills: skillEvaluation.missingSkills,
    matchedCoreSkills: skillEvaluation.matchedCoreSkills,
    missingCoreSkills: skillEvaluation.missingCoreSkills,
    missingSecondarySkills: skillEvaluation.missingSecondarySkills,
    incidentalMismatches: skillEvaluation.incidentalMismatches,
    keywordGaps: skillEvaluation.keywordGaps,
    relevantProjects,
    risks: riskSummary.descriptiveRisks,
  };
}
