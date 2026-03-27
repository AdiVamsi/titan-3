/**
 * Candidate profile for job scoring and matching
 * Represents the target profile for the job hunt
 */

export interface CandidateProfile {
  targetTitles: string[];
  coreSkills: string[];
  preferredSkills: string[];
  aiSkills: string[];
  backendSkills: string[];
  experienceYears: number;
  seniorityLevel: string;
  workAuth: string;
  locationPref: string;
}

export const CANDIDATE_PROFILE: CandidateProfile = {
  targetTitles: [
    'AI Engineer',
    'Applied AI Engineer',
    'LLM Application Engineer',
    'Software Engineer',
    'Backend Engineer',
    'GenAI Engineer',
    'ML Engineer',
    'Python Developer',
  ],

  coreSkills: [
    'Python',
    'Java',
    'JavaScript',
    'SQL',
    'REST APIs',
    'Microservices',
    'Spring Boot',
    'Node.js',
    'Express',
    'PostgreSQL',
  ],

  preferredSkills: [
    'LLMs',
    'RAG',
    'Embeddings',
    'Vector Search',
    'AI Agents',
    'Agentic Workflows',
    'Prompt Engineering',
    'LLM APIs',
    'AI Automation',
    'GenAI',
    'Langchain',
    'OpenAI API',
    'Claude API',
  ],

  aiSkills: [
    'LLMs',
    'RAG',
    'Embeddings',
    'AI Agents',
    'Prompt Engineering',
    'GenAI',
    'NLP',
    'Machine Learning',
    'Deep Learning',
    'Vector Databases',
    'Transformers',
  ],

  backendSkills: [
    'REST APIs',
    'Microservices',
    'Spring Boot',
    'Node.js',
    'Express',
    'PostgreSQL',
    'MySQL',
    'Redis',
    'Docker',
    'AWS',
    'CI/CD',
    'System Design',
  ],

  experienceYears: 3.5,
  seniorityLevel: 'mid',
  workAuth:
    'Authorized to work in the U.S. under STEM OPT. No immediate sponsorship required; future employment sponsorship will be needed.',
  locationPref:
    'flexible', // open to relocate anywhere in US, remote preferred
};
