# Forze — Venture Object Schema

This is the single source of truth shared across all agents.
Every agent reads from and writes to this object.
Never change this schema without explicit instruction.

---

## Full Schema

```typescript
interface VentureObject {
  // Identity
  ventureId: string;           // UUID
  userId: string;              // UUID
  name: string;                // User-defined venture name
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp

  // Conversations — one array per module, each entry is a run
  conversations: {
    [moduleId: string]: Conversation[];
  };

  // Context — accumulated agent outputs, used for cross-agent injection
  context: {
    research:    GenesisOutput    | null;
    branding:    IdentityOutput   | null;
    marketing:   ContentOutput    | null;
    landing:     PipelineOutput   | null;
    feasibility: FeasibilityOutput | null;
  };
}

interface Conversation {
  conversationId: string;      // UUID
  moduleId: string;            // research | branding | marketing | landing | feasibility | full-launch
  prompt: string;              // User's raw input
  status: 'running' | 'complete' | 'failed';
  streamOutput: string[];      // Array of output lines as they arrived
  result: Record<string, unknown>; // Structured final output from agent
  createdAt: string;           // ISO timestamp
}
```

---

## Agent Output Schemas

### GenesisOutput (Research)

```typescript
interface GenesisOutput {
  marketSummary: string;
  tam: {
    value: string;             // e.g. "$4.2B"
    source: string;            // citation
    methodology: string;
  };
  sam: { value: string; source: string; };
  som: { value: string; rationale: string; };
  painPoints: Array<{
    description: string;
    source: string;            // e.g. "Reddit r/entrepreneur"
    frequency: 'high' | 'medium' | 'low';
  }>;
  competitors: Array<{
    name: string;
    positioning: string;
    weakness: string;
  }>;
  competitorGap: string;       // The main gap Forze's venture can fill
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  riskMatrix: Array<{
    risk: string;
    likelihood: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    score: number;             // 1–9
  }>;
  topConcepts: Array<{
    name: string;
    description: string;
    opportunityScore: number;  // 1–10
    rationale: string;
  }>;
  recommendedConcept: string;  // Name of the top-ranked concept
}
```

---

### IdentityOutput (Branding)

```typescript
interface IdentityOutput {
  brandName: string;
  brandNameRationale: string;
  nameCandidates: string[];    // All 5 options considered
  tagline: string;
  missionStatement: string;
  brandArchetype: string;      // e.g. "The Challenger"
  brandPersonality: string[];  // e.g. ["Direct", "Calm", "Confident"]
  toneOfVoice: {
    description: string;
    doExamples: string[];
    dontExamples: string[];
  };
  colorPalette: Array<{
    name: string;
    hex: string;
    role: string;              // e.g. "Primary", "Accent", "Background"
    psychology: string;
  }>;
  typography: {
    displayFont: string;
    bodyFont: string;
    usageRules: string;
  };
  logoConceptDescriptions: string[]; // 3 text descriptions for image gen
  uiKitSpec: {
    borderRadius: string;
    spacing: string;
    buttonStyle: string;
    cardStyle: string;
  };
}
```

---

### ContentOutput (Marketing)

```typescript
interface ContentOutput {
  gtmStrategy: {
    overview: string;
    weeks: Array<{
      week: number;
      theme: string;
      actions: string[];
      kpis: string[];
    }>;
  };
  socialCalendar: Array<{
    day: number;
    platform: 'x' | 'linkedin' | 'instagram';
    caption: string;
    hashtags: string[];
    postType: string;          // e.g. "Educational", "Launch", "Social proof"
  }>;
  seoOutlines: Array<{
    title: string;
    targetKeyword: string;
    searchIntent: string;
    outline: string[];
    estimatedTraffic: string;
  }>;
  emailSequence: Array<{
    day: number;
    subject: string;
    preview: string;
    bodyOutline: string[];
  }>;
  hashtagStrategy: {
    x: string[];
    linkedin: string[];
    instagram: string[];
  };
}
```

---

### PipelineOutput (Landing Page)

```typescript
interface PipelineOutput {
  sitemap: Array<{
    page: string;
    path: string;
    purpose: string;
  }>;
  landingPageCopy: {
    hero: {
      headline: string;
      subheadline: string;
      ctaPrimary: string;
      ctaSecondary: string;
    };
    features: Array<{
      title: string;
      description: string;
      icon: string;
    }>;
    socialProof: string[];
    pricing: Array<{
      tier: string;
      price: string;
      features: string[];
      cta: string;
    }>;
    faq: Array<{
      question: string;
      answer: string;
    }>;
  };
  deploymentUrl: string;       // Live URL — must be real and accessible
  leadCaptureActive: boolean;
  analyticsActive: boolean;
  seoMetadata: {
    title: string;
    description: string;
    keywords: string[];
  };
}
```

---

### FeasibilityOutput (Feasibility Study)

```typescript
interface FeasibilityOutput {
  verdict: 'GO' | 'NO-GO' | 'CONDITIONAL GO';
  verdictRationale: string;
  marketTimingScore: number;   // 1–10
  marketTimingRationale: string;
  financialModel: {
    assumptions: Record<string, string>;
    yearOne: {
      revenue: string;
      costs: string;
      netIncome: string;
      customers: string;
    };
    yearTwo: {
      revenue: string;
      costs: string;
      netIncome: string;
      customers: string;
    };
    yearThree: {
      revenue: string;
      costs: string;
      netIncome: string;
      customers: string;
    };
    breakEvenMonth: number;
    cac: string;
    ltv: string;
    ltvCacRatio: string;
  };
  risks: Array<{
    category: string;
    risk: string;
    likelihood: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    mitigation: string;
  }>;
  competitiveMoat: string;
  regulatoryLandscape: string;
  keyAssumptions: string[];
  keyRisksToMonitor: string[];
  reportSections: string[];    // Table of contents of the 20-page study
}
```

---

## Context Injection Rules

These rules govern which agent outputs get injected into each agent's context:

| Agent | Reads From |
|-------|-----------|
| Genesis (Research) | venture.name + venture.conversations (for follow-up) |
| Identity (Branding) | venture.context.research (required) |
| Content (Marketing) | venture.context.research + venture.context.branding |
| Pipeline (Landing) | venture.context.research + venture.context.branding + venture.context.marketing (if available) |
| Feasibility | venture.context.research (required) |
| Full Launch | All agents read from the accumulating context as each completes |

---

## JSON Example (Minimal)

```json
{
  "ventureId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "FeedFlow",
  "createdAt": "2026-03-09T10:00:00Z",
  "updatedAt": "2026-03-09T10:32:00Z",
  "conversations": {
    "research": [
      {
        "conversationId": "abc123",
        "moduleId": "research",
        "prompt": "Validate an async client feedback tool for freelance designers",
        "status": "complete",
        "streamOutput": ["Initializing Genesis Engine...", "..."],
        "result": {},
        "createdAt": "2026-03-09T10:00:00Z"
      }
    ]
  },
  "context": {
    "research": {
      "marketSummary": "...",
      "tam": { "value": "$4.2B", "source": "...", "methodology": "..." }
    },
    "branding": null,
    "marketing": null,
    "landing": null,
    "feasibility": null
  }
}
```