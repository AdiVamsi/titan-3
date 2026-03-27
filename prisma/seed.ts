/**
 * Seed script for Titan-3 Review Console database
 * Creates sample data for testing and demo purposes
 * Idempotent using upsert patterns
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create or update ResumeProfile
  const resumeProfile = await prisma.resumeProfile.upsert({
    where: { label: 'primary' },
    update: {
      targetTitles: [
        'AI Engineer',
        'Applied AI Engineer',
        'LLM Application Engineer',
        'Software Engineer',
        'Backend Engineer',
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
        'PostgreSQL',
      ],
      preferredSkills: [
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'AI Agents',
        'Prompt Engineering',
        'GenAI',
      ],
      experienceYears: 3.5,
      workAuth:
        'Authorized to work in the U.S. under STEM OPT. No immediate sponsorship required; future employment sponsorship will be needed.',
    },
    create: {
      label: 'primary',
      targetTitles: [
        'AI Engineer',
        'Applied AI Engineer',
        'LLM Application Engineer',
        'Software Engineer',
        'Backend Engineer',
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
        'PostgreSQL',
      ],
      preferredSkills: [
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'AI Agents',
        'Prompt Engineering',
        'GenAI',
      ],
      experienceYears: 3.5,
      workAuth:
        'Authorized to work in the U.S. under STEM OPT. No immediate sponsorship required; future employment sponsorship will be needed.',
    },
  });

  console.log('Resume profile created:', resumeProfile.id);

  // 2. Create adapter capabilities
  const adapters = [
    {
      adapterId: 'greenhouse',
      sourceType: 'GREENHOUSE',
      canIngest: true,
      canApply: true,
      canPrefill: true,
      requiresHumanReview: false,
      supportsResumeUpload: true,
      supportsQuestionHandling: true,
      notes: 'Full integration with Greenhouse ATS. Automated ingestion and application.',
    },
    {
      adapterId: 'lever',
      sourceType: 'LEVER',
      canIngest: true,
      canApply: true,
      canPrefill: true,
      requiresHumanReview: false,
      supportsResumeUpload: true,
      supportsQuestionHandling: true,
      notes: 'Full integration with Lever ATS. API-based ingestion and application.',
    },
    {
      adapterId: 'manual',
      sourceType: 'MANUAL',
      canIngest: true,
      canApply: false,
      canPrefill: false,
      requiresHumanReview: true,
      supportsResumeUpload: false,
      supportsQuestionHandling: false,
      notes: 'Manual job entry. Applications must be completed manually.',
    },
    {
      adapterId: 'browser',
      sourceType: 'BROWSER',
      canIngest: true,
      canApply: false,
      canPrefill: true,
      requiresHumanReview: true,
      supportsResumeUpload: true,
      supportsQuestionHandling: false,
      notes: 'Browser automation for ingestion and form prefill.',
    },
  ];

  for (const adapter of adapters) {
    await prisma.adapterCapability.upsert({
      where: { adapterId: adapter.adapterId },
      update: adapter,
      create: adapter,
    });
  }

  console.log('Adapter capabilities created');

  // 3. Create sample companies
  const brightPlan = await prisma.company.upsert({
    where: { domain: 'brightplan.com' },
    update: {
      name: 'BrightPlan',
      industry: 'FinTech',
      size: '50-100',
      sponsorHistory: 'Open to sponsorship for mid-level+',
      notes: 'Growing fintech startup focused on financial wellness.',
    },
    create: {
      name: 'BrightPlan',
      domain: 'brightplan.com',
      industry: 'FinTech',
      size: '50-100',
      sponsorHistory: 'Open to sponsorship for mid-level+',
      notes: 'Growing fintech startup focused on financial wellness.',
    },
  });

  const stanleyDavid = await prisma.company.upsert({
    where: { domain: 'stanleydavid.com' },
    update: {
      name: 'Stanley David',
      industry: 'Staffing/Recruiting',
      size: '100-500',
      sponsorHistory: 'Available for right candidates',
      notes: 'Tech recruiting and staffing firm.',
    },
    create: {
      name: 'Stanley David',
      domain: 'stanleydavid.com',
      industry: 'Staffing/Recruiting',
      size: '100-500',
      sponsorHistory: 'Available for right candidates',
      notes: 'Tech recruiting and staffing firm.',
    },
  });

  console.log('Companies created');

  // 4. Create sample jobs with content and scores
  // Job 1: High fit - Applied AI Engineer at BrightPlan
  const job1 = await prisma.job.upsert({
    where: { canonicalUrl: 'https://brightplan.com/careers/applied-ai-engineer' },
    update: {
      title: 'Applied AI Engineer',
      companyName: 'BrightPlan',
      status: 'READY',
      fitScore: 85,
    },
    create: {
      sourceType: 'INDEED',
      sourceUrl: 'https://www.indeed.com/jobs?q=applied+ai+engineer&l=remote&jid=12345',
      canonicalUrl: 'https://brightplan.com/careers/applied-ai-engineer',
      title: 'Applied AI Engineer',
      companyName: 'BrightPlan',
      companyId: brightPlan.id,
      location: 'Remote',
      workplaceType: 'REMOTE',
      salaryText: '$125,000 - $155,000/year',
      status: 'READY',
      sponsorshipRisk: 'LIKELY_SAFE',
      fitScore: 85,
    },
  });

  await prisma.jobContent.upsert({
    where: { jobId: job1.id },
    update: {
      rawText: `BrightPlan is seeking an Applied AI Engineer to join our growing team. We're building the next generation of AI-powered financial wellness tools.

Responsibilities:
- Design and implement Python-based LLM applications using RAG patterns
- Develop REST APIs that integrate with our AI pipelines
- Build vector search systems for semantic retrieval
- Work with embeddings and transformer models
- Collaborate with product and design on AI features

Requirements:
- 3+ years of Python development experience
- Strong understanding of LLMs and RAG architectures
- Experience with embeddings, vector databases, and semantic search
- REST API design and microservices architecture
- PostgreSQL or similar databases

Nice to have:
- Experience with AI agents and agentic workflows
- Prompt engineering expertise
- Knowledge of Vector Search solutions
- GenAI application development`,
      requirements: [
        'Python',
        'LLMs',
        'RAG',
        'REST APIs',
        'Embeddings',
        'Vector Search',
        'PostgreSQL',
      ],
      niceToHaves: ['AI Agents', 'Prompt Engineering', 'GenAI'],
      responsibilities: [
        'Design and implement Python-based LLM applications',
        'Develop REST APIs for AI pipelines',
        'Build vector search systems',
      ],
    },
    create: {
      jobId: job1.id,
      rawText: `BrightPlan is seeking an Applied AI Engineer to join our growing team. We're building the next generation of AI-powered financial wellness tools.

Responsibilities:
- Design and implement Python-based LLM applications using RAG patterns
- Develop REST APIs that integrate with our AI pipelines
- Build vector search systems for semantic retrieval
- Work with embeddings and transformer models
- Collaborate with product and design on AI features

Requirements:
- 3+ years of Python development experience
- Strong understanding of LLMs and RAG architectures
- Experience with embeddings, vector databases, and semantic search
- REST API design and microservices architecture
- PostgreSQL or similar databases

Nice to have:
- Experience with AI agents and agentic workflows
- Prompt engineering expertise
- Knowledge of Vector Search solutions
- GenAI application development`,
      requirements: [
        'Python',
        'LLMs',
        'RAG',
        'REST APIs',
        'Embeddings',
        'Vector Search',
        'PostgreSQL',
      ],
      niceToHaves: ['AI Agents', 'Prompt Engineering', 'GenAI'],
      responsibilities: [
        'Design and implement Python-based LLM applications',
        'Develop REST APIs for AI pipelines',
        'Build vector search systems',
      ],
    },
  });

  await prisma.jobScore.upsert({
    where: { jobId: job1.id },
    update: {
      titleFit: 90,
      skillsFit: 88,
      seniorityFit: 95,
      aiRelevance: 95,
      backendRelevance: 85,
      locationFit: 100,
      sponsorshipRisk: 85,
      overallScore: 85,
      rationale:
        'Excellent title match; outstanding skill coverage; highly relevant AI role; favorable sponsorship terms.',
      matchedSkills: [
        'Python',
        'REST APIs',
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'PostgreSQL',
      ],
      missingSkills: ['Spring Boot', 'Java'],
      keywordGaps: [],
    },
    create: {
      jobId: job1.id,
      titleFit: 90,
      skillsFit: 88,
      seniorityFit: 95,
      aiRelevance: 95,
      backendRelevance: 85,
      locationFit: 100,
      sponsorshipRisk: 85,
      overallScore: 85,
      rationale:
        'Excellent title match; outstanding skill coverage; highly relevant AI role; favorable sponsorship terms.',
      matchedSkills: [
        'Python',
        'REST APIs',
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'PostgreSQL',
      ],
      missingSkills: ['Spring Boot', 'Java'],
      keywordGaps: [],
    },
  });

  // Create review packet for Job 1
  await prisma.reviewPacket.upsert({
    where: { jobId: job1.id },
    update: {
      resumeEmphasis: [
        'Led RAG pipeline implementation at previous company',
        'Built production Python APIs handling 1M+ requests/day',
        'Expertise in embeddings and vector search optimization',
      ],
      summaryRewrite:
        'Applied AI Engineer with 3.5 years building production LLM systems. Specialized in RAG architectures, embeddings, and API design. Seeking to leverage AI expertise at BrightPlan.',
      bulletsToHighlight: [
        'Designed and deployed RAG-based semantic search system',
        'Implemented vector embeddings pipeline with 200k+ documents',
        'Developed REST APIs for AI model inference serving',
        'Optimized PostgreSQL queries for high-scale data retrieval',
      ],
      interviewPrepBullets: [
        'Prepare examples of RAG projects and results',
        'Review vector databases and embedding selection criteria',
        'Discuss API design patterns for ML systems',
        'Research BrightPlan financial wellness product',
      ],
      risks: [],
      whyApply:
        'Perfect fit combining AI/ML expertise with financial services. Role directly uses RAG and embeddings expertise. Remote role enables work flexibility.',
      sponsorNotes: null,
      generatedBy: 'claude',
    },
    create: {
      jobId: job1.id,
      resumeEmphasis: [
        'Led RAG pipeline implementation at previous company',
        'Built production Python APIs handling 1M+ requests/day',
        'Expertise in embeddings and vector search optimization',
      ],
      summaryRewrite:
        'Applied AI Engineer with 3.5 years building production LLM systems. Specialized in RAG architectures, embeddings, and API design. Seeking to leverage AI expertise at BrightPlan.',
      bulletsToHighlight: [
        'Designed and deployed RAG-based semantic search system',
        'Implemented vector embeddings pipeline with 200k+ documents',
        'Developed REST APIs for AI model inference serving',
        'Optimized PostgreSQL queries for high-scale data retrieval',
      ],
      interviewPrepBullets: [
        'Prepare examples of RAG projects and results',
        'Review vector databases and embedding selection criteria',
        'Discuss API design patterns for ML systems',
        'Research BrightPlan financial wellness product',
      ],
      risks: [],
      whyApply:
        'Perfect fit combining AI/ML expertise with financial services. Role directly uses RAG and embeddings expertise. Remote role enables work flexibility.',
      sponsorNotes: null,
      generatedBy: 'claude',
    },
  });

  console.log('Job 1 created: Applied AI Engineer at BrightPlan');

  // Job 2: High fit - AI ML Engineer at Stanley David
  const job2 = await prisma.job.upsert({
    where: { canonicalUrl: 'https://careers.stanley-david.com/ai-ml-engineer-remote' },
    update: {
      title: 'AI ML Engineer',
      companyName: 'Stanley David',
      status: 'READY',
      fitScore: 82,
    },
    create: {
      sourceType: 'DICE',
      sourceUrl: 'https://www.dice.com/jobs?q=ai+ml+engineer&loc=remote&jid=67890',
      canonicalUrl: 'https://careers.stanley-david.com/ai-ml-engineer-remote',
      title: 'AI ML Engineer',
      companyName: 'Stanley David',
      companyId: stanleyDavid.id,
      location: 'Remote',
      workplaceType: 'REMOTE',
      salaryText: '$120,000 - $150,000/year',
      status: 'READY',
      sponsorshipRisk: 'LIKELY_SAFE',
      fitScore: 82,
    },
  });

  await prisma.jobContent.upsert({
    where: { jobId: job2.id },
    update: {
      rawText: `Stanley David seeks an AI/ML Engineer for remote role with technical staffing client.

We are looking for an engineer with strong Python skills and machine learning background to work on LLM and AI projects.

Key Responsibilities:
- Develop Python-based ML applications
- Work with LLM APIs and models
- Implement RAG pipelines for information retrieval
- Build embeddings-based systems
- Conduct vector search optimization

Required:
- 3+ years Python development
- LLM application development
- RAG systems understanding
- Embeddings and vector search experience
- REST API development

Preferred:
- ML/AI engineering experience
- Database optimization skills`,
      requirements: [
        'Python',
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'REST APIs',
      ],
      niceToHaves: ['Machine Learning', 'AI Agents'],
      responsibilities: [
        'Develop AI/ML applications',
        'Implement RAG systems',
        'Optimize vector search',
      ],
    },
    create: {
      jobId: job2.id,
      rawText: `Stanley David seeks an AI/ML Engineer for remote role with technical staffing client.

We are looking for an engineer with strong Python skills and machine learning background to work on LLM and AI projects.

Key Responsibilities:
- Develop Python-based ML applications
- Work with LLM APIs and models
- Implement RAG pipelines for information retrieval
- Build embeddings-based systems
- Conduct vector search optimization

Required:
- 3+ years Python development
- LLM application development
- RAG systems understanding
- Embeddings and vector search experience
- REST API development

Preferred:
- ML/AI engineering experience
- Database optimization skills`,
      requirements: [
        'Python',
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'REST APIs',
      ],
      niceToHaves: ['Machine Learning', 'AI Agents'],
      responsibilities: [
        'Develop AI/ML applications',
        'Implement RAG systems',
        'Optimize vector search',
      ],
    },
  });

  await prisma.jobScore.upsert({
    where: { jobId: job2.id },
    update: {
      titleFit: 85,
      skillsFit: 85,
      seniorityFit: 90,
      aiRelevance: 90,
      backendRelevance: 80,
      locationFit: 100,
      sponsorshipRisk: 80,
      overallScore: 82,
      rationale:
        'Strong title alignment; excellent skill match for AI/ML focus; relevant RAG and embeddings requirements; remote opportunity.',
      matchedSkills: [
        'Python',
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'REST APIs',
      ],
      missingSkills: ['Microservices'],
      keywordGaps: [],
    },
    create: {
      jobId: job2.id,
      titleFit: 85,
      skillsFit: 85,
      seniorityFit: 90,
      aiRelevance: 90,
      backendRelevance: 80,
      locationFit: 100,
      sponsorshipRisk: 80,
      overallScore: 82,
      rationale:
        'Strong title alignment; excellent skill match for AI/ML focus; relevant RAG and embeddings requirements; remote opportunity.',
      matchedSkills: [
        'Python',
        'LLMs',
        'RAG',
        'Embeddings',
        'Vector Search',
        'REST APIs',
      ],
      missingSkills: ['Microservices'],
      keywordGaps: [],
    },
  });

  console.log('Job 2 created: AI ML Engineer at Stanley David');

  // Job 3: Low fit - Senior Staff ML Engineer (overleveled)
  const job3 = await prisma.job.upsert({
    where: { canonicalUrl: 'https://bigcorp.jobs/senior-staff-ml-engineer' },
    update: {
      title: 'Senior Staff ML Engineer',
      status: 'REVIEWED',
      fitScore: 35,
    },
    create: {
      sourceType: 'LINKEDIN',
      sourceUrl: 'https://www.linkedin.com/jobs/view/bigcorp-senior-staff-ml',
      canonicalUrl: 'https://bigcorp.jobs/senior-staff-ml-engineer',
      title: 'Senior Staff ML Engineer',
      companyName: 'BigCorp',
      location: 'New York, NY',
      workplaceType: 'ONSITE',
      salaryText: '$250,000 - $350,000/year + equity',
      status: 'REVIEWED',
      sponsorshipRisk: 'UNCERTAIN',
      fitScore: 35,
    },
  });

  await prisma.jobContent.upsert({
    where: { jobId: job3.id },
    update: {
      rawText: `BigCorp seeks a Senior Staff ML Engineer to lead machine learning research and development.

This is a leadership role requiring 10+ years of ML/AI experience and PhD in related field.

Requirements:
- PhD in Computer Science, ML, or related field required
- 10+ years ML/AI industry experience
- Published research in top-tier conferences
- Leadership experience managing 5+ engineers
- Expertise in large-scale distributed ML systems

We are looking for someone to drive our ML research agenda.`,
      requirements: [
        'PhD',
        '10+ years ML experience',
        'Leadership skills',
        'Distributed ML systems',
      ],
      niceToHaves: ['Published research', 'Deep learning expertise'],
      responsibilities: ['Lead ML research', 'Manage engineering team'],
    },
    create: {
      jobId: job3.id,
      rawText: `BigCorp seeks a Senior Staff ML Engineer to lead machine learning research and development.

This is a leadership role requiring 10+ years of ML/AI experience and PhD in related field.

Requirements:
- PhD in Computer Science, ML, or related field required
- 10+ years ML/AI industry experience
- Published research in top-tier conferences
- Leadership experience managing 5+ engineers
- Expertise in large-scale distributed ML systems

We are looking for someone to drive our ML research agenda.`,
      requirements: [
        'PhD',
        '10+ years ML experience',
        'Leadership skills',
        'Distributed ML systems',
      ],
      niceToHaves: ['Published research', 'Deep learning expertise'],
      responsibilities: ['Lead ML research', 'Manage engineering team'],
    },
  });

  await prisma.jobScore.upsert({
    where: { jobId: job3.id },
    update: {
      titleFit: 40,
      skillsFit: 50,
      seniorityFit: 20,
      aiRelevance: 70,
      backendRelevance: 40,
      locationFit: 60,
      sponsorshipRisk: 70,
      overallScore: 35,
      rationale:
        'Title may not be ideal fit; some skill gaps; overleveled position (10+ years, PhD required); not mid-level appropriate.',
      matchedSkills: ['Python', 'Machine Learning'],
      missingSkills: ['Leadership experience', 'PhD credentials', 'Published research'],
      keywordGaps: ['Distributed systems research'],
    },
    create: {
      jobId: job3.id,
      titleFit: 40,
      skillsFit: 50,
      seniorityFit: 20,
      aiRelevance: 70,
      backendRelevance: 40,
      locationFit: 60,
      sponsorshipRisk: 70,
      overallScore: 35,
      rationale:
        'Title may not be ideal fit; some skill gaps; overleveled position (10+ years, PhD required); not mid-level appropriate.',
      matchedSkills: ['Python', 'Machine Learning'],
      missingSkills: ['Leadership experience', 'PhD credentials', 'Published research'],
      keywordGaps: ['Distributed systems research'],
    },
  });

  console.log('Job 3 created: Senior Staff ML Engineer at BigCorp (overleveled)');

  // Job 4: Medium fit - Backend Software Engineer at TechStartup
  const job4 = await prisma.job.upsert({
    where: { canonicalUrl: 'https://techstartup.jobs/backend-engineer-nodejs' },
    update: {
      title: 'Backend Software Engineer',
      status: 'SCORED',
      fitScore: 68,
    },
    create: {
      sourceType: 'INDEED',
      sourceUrl: 'https://www.indeed.com/jobs?q=backend+nodejs&l=remote',
      canonicalUrl: 'https://techstartup.jobs/backend-engineer-nodejs',
      title: 'Backend Software Engineer',
      companyName: 'TechStartup',
      location: 'Remote',
      workplaceType: 'REMOTE',
      salaryText: '$110,000 - $140,000/year',
      status: 'SCORED',
      sponsorshipRisk: 'LIKELY_SAFE',
      fitScore: 68,
    },
  });

  await prisma.jobContent.upsert({
    where: { jobId: job4.id },
    update: {
      rawText: `TechStartup is hiring a Backend Software Engineer to build scalable APIs and services.

Role focuses on Node.js development with some AI/ML integration.

Responsibilities:
- Develop and maintain REST APIs using Node.js
- Design and implement microservices architecture
- Work with PostgreSQL and caching layers
- Some AI feature integration work
- Write clean, maintainable code

Requirements:
- 2+ years Node.js development
- REST API design experience
- PostgreSQL or similar database
- Docker containerization
- Microservices understanding

Nice to have:
- AI/ML framework exposure
- GraphQL experience`,
      requirements: ['Node.js', 'REST APIs', 'PostgreSQL', 'Docker', 'Microservices'],
      niceToHaves: ['AI/ML integration', 'GraphQL'],
      responsibilities: [
        'Build REST APIs',
        'Design microservices',
        'Work with databases',
        'AI feature integration',
      ],
    },
    create: {
      jobId: job4.id,
      rawText: `TechStartup is hiring a Backend Software Engineer to build scalable APIs and services.

Role focuses on Node.js development with some AI/ML integration.

Responsibilities:
- Develop and maintain REST APIs using Node.js
- Design and implement microservices architecture
- Work with PostgreSQL and caching layers
- Some AI feature integration work
- Write clean, maintainable code

Requirements:
- 2+ years Node.js development
- REST API design experience
- PostgreSQL or similar database
- Docker containerization
- Microservices understanding

Nice to have:
- AI/ML framework exposure
- GraphQL experience`,
      requirements: ['Node.js', 'REST APIs', 'PostgreSQL', 'Docker', 'Microservices'],
      niceToHaves: ['AI/ML integration', 'GraphQL'],
      responsibilities: [
        'Build REST APIs',
        'Design microservices',
        'Work with databases',
        'AI feature integration',
      ],
    },
  });

  await prisma.jobScore.upsert({
    where: { jobId: job4.id },
    update: {
      titleFit: 70,
      skillsFit: 72,
      seniorityFit: 85,
      aiRelevance: 40,
      backendRelevance: 85,
      locationFit: 100,
      sponsorshipRisk: 75,
      overallScore: 68,
      rationale:
        'Moderate title alignment; good skill match for backend focus; strong seniority fit; lower AI relevance but solid backend requirements.',
      matchedSkills: ['JavaScript', 'Node.js', 'REST APIs', 'PostgreSQL', 'Microservices'],
      missingSkills: ['Python'],
      keywordGaps: [],
    },
    create: {
      jobId: job4.id,
      titleFit: 70,
      skillsFit: 72,
      seniorityFit: 85,
      aiRelevance: 40,
      backendRelevance: 85,
      locationFit: 100,
      sponsorshipRisk: 75,
      overallScore: 68,
      rationale:
        'Moderate title alignment; good skill match for backend focus; strong seniority fit; lower AI relevance but solid backend requirements.',
      matchedSkills: ['JavaScript', 'Node.js', 'REST APIs', 'PostgreSQL', 'Microservices'],
      missingSkills: ['Python'],
      keywordGaps: [],
    },
  });

  console.log('Job 4 created: Backend Software Engineer at TechStartup');

  // Job 5: Blocked - AI Engineer requiring security clearance (sponsorship risk)
  const job5 = await prisma.job.upsert({
    where: { canonicalUrl: 'https://defenseco.jobs/ai-engineer-ts-sci' },
    update: {
      title: 'AI Engineer',
      status: 'REVIEWED',
      fitScore: 25,
    },
    create: {
      sourceType: 'LINKEDIN',
      sourceUrl: 'https://www.linkedin.com/jobs/view/defenseco-ai-engineer',
      canonicalUrl: 'https://defenseco.jobs/ai-engineer-ts-sci',
      title: 'AI Engineer',
      companyName: 'DefenseCo',
      location: 'Arlington, VA',
      workplaceType: 'ONSITE',
      salaryText: '$130,000 - $170,000/year',
      status: 'REVIEWED',
      sponsorshipRisk: 'BLOCKED',
      fitScore: 25,
    },
  });

  await prisma.jobContent.upsert({
    where: { jobId: job5.id },
    update: {
      rawText: `DefenseCo seeks an AI Engineer for advanced AI/ML development on critical projects.

IMPORTANT: Requires US Citizen status with active TS/SCI security clearance.

Requirements:
- US Citizen (REQUIRED)
- Active TS/SCI security clearance (REQUIRED)
- 3+ years AI/ML engineering
- Python and ML frameworks
- Can work on-site in Arlington, VA

This position cannot support visa sponsorship or OPT candidates.`,
      requirements: [
        'US Citizen required',
        'TS/SCI clearance required',
        'Python',
        'ML Engineering',
      ],
      niceToHaves: [],
      responsibilities: ['Develop AI/ML systems', 'Work on classified projects'],
    },
    create: {
      jobId: job5.id,
      rawText: `DefenseCo seeks an AI Engineer for advanced AI/ML development on critical projects.

IMPORTANT: Requires US Citizen status with active TS/SCI security clearance.

Requirements:
- US Citizen (REQUIRED)
- Active TS/SCI security clearance (REQUIRED)
- 3+ years AI/ML engineering
- Python and ML frameworks
- Can work on-site in Arlington, VA

This position cannot support visa sponsorship or OPT candidates.`,
      requirements: [
        'US Citizen required',
        'TS/SCI clearance required',
        'Python',
        'ML Engineering',
      ],
      niceToHaves: [],
      responsibilities: ['Develop AI/ML systems', 'Work on classified projects'],
    },
  });

  await prisma.jobScore.upsert({
    where: { jobId: job5.id },
    update: {
      titleFit: 75,
      skillsFit: 70,
      seniorityFit: 80,
      aiRelevance: 80,
      backendRelevance: 50,
      locationFit: 20,
      sponsorshipRisk: 5,
      overallScore: 25,
      rationale:
        'Good title and skill match; potential sponsorship concerns; requires US citizenship and active clearance; on-site location not ideal; STEM OPT candidate cannot meet requirements.',
      matchedSkills: ['Python', 'Machine Learning'],
      missingSkills: [],
      keywordGaps: ['US citizenship requirement', 'TS/SCI clearance requirement'],
    },
    create: {
      jobId: job5.id,
      titleFit: 75,
      skillsFit: 70,
      seniorityFit: 80,
      aiRelevance: 80,
      backendRelevance: 50,
      locationFit: 20,
      sponsorshipRisk: 5,
      overallScore: 25,
      rationale:
        'Good title and skill match; potential sponsorship concerns; requires US citizenship and active clearance; on-site location not ideal; STEM OPT candidate cannot meet requirements.',
      matchedSkills: ['Python', 'Machine Learning'],
      missingSkills: [],
      keywordGaps: ['US citizenship requirement', 'TS/SCI clearance requirement'],
    },
  });

  console.log('Job 5 created: AI Engineer at DefenseCo (sponsorship blocked)');

  // 5. Create some audit logs
  const job1Record = await prisma.job.findUnique({ where: { id: job1.id } });

  if (job1Record) {
    await prisma.auditLog.create({
      data: {
        jobId: job1Record.id,
        action: 'INGESTED',
        actor: 'INGEST_WORKER',
        details: {
          source: 'INDEED',
          title: 'Applied AI Engineer',
          company: 'BrightPlan',
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        jobId: job1Record.id,
        action: 'SCORED',
        actor: 'SCORE_WORKER',
        details: {
          overallScore: 85,
          sponsorshipRisk: 'LIKELY_SAFE',
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        jobId: job1Record.id,
        action: 'PACKET_GENERATED',
        actor: 'PACKET_WORKER',
        details: {
          provider: 'claude',
          hasOutreach: true,
        },
      },
    });
  }

  console.log('Seed completed successfully!');
  console.log(
    '\nSummary:',
    `- 1 Resume Profile (primary)`,
    `- 4 Adapter Capabilities`,
    `- 2 Companies`,
    `- 5 Sample Jobs with content and scores`,
    `- Job 1 with full review packet`,
    `- Audit logs for demonstration`,
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
