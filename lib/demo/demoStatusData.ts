// lib/demo/demoStatusData.ts
// Returns synthetic component-based status data for the /status endpoint in demo mode.

type ItemStatus = "operational" | "degraded" | "down" | "unknown";
type OverallStatus = "operational" | "degraded" | "outage" | "unknown";

interface StatusItem {
  name: string;
  status: ItemStatus;
}

interface StatusComponent {
  id: string;
  name: string;
  description: string;
  status: ItemStatus;
  uptime: number | null;
  items: StatusItem[];
}

export interface StatusResponse {
  overall: OverallStatus;
  last_checked: string;
  components: StatusComponent[];
}

export function getDemoStatusResponse(): StatusResponse {
  return {
    overall: "operational",
    last_checked: new Date().toISOString(),
    components: [
      {
        id: "patient-portal",
        name: "Patient Portal",
        description: "Patient-facing join, check-in, history, and goals",
        status: "operational",
        uptime: 100,
        items: [
          { name: "Join Code & Onboarding", status: "operational" },
          { name: "Weekly Check-In", status: "operational" },
          { name: "Check-In History", status: "operational" },
          { name: "Goals", status: "operational" },
        ],
      },
      {
        id: "session-prep",
        name: "Session Prep",
        description: "AI-generated pre-session briefings for therapists",
        status: "operational",
        uptime: 100,
        items: [
          { name: "AI Generation", status: "operational" },
          { name: "PHI Redaction", status: "operational" },
          { name: "Review Gate", status: "operational" },
        ],
      },
      {
        id: "therapist-views",
        name: "Therapist Views",
        description: "Case management and session tools for therapists",
        status: "operational",
        uptime: 100,
        items: [
          { name: "Case List", status: "operational" },
          { name: "Case Detail", status: "operational" },
          { name: "Session Prep Card", status: "operational" },
        ],
      },
      {
        id: "practice-dashboard",
        name: "Practice Dashboard",
        description: "Practice health and activity monitoring for managers",
        status: "operational",
        uptime: 100,
        items: [
          { name: "Practice Status", status: "operational" },
          { name: "Health Score", status: "operational" },
          { name: "Activity Feed", status: "operational" },
        ],
      },
      {
        id: "authentication",
        name: "Authentication",
        description: "Role selection and portal access",
        status: "operational",
        uptime: 100,
        items: [
          { name: "Role Selector", status: "operational" },
          { name: "Portal Auth (Join Code)", status: "operational" },
          { name: "Admin Access", status: "operational" },
        ],
      },
      {
        id: "ai-services",
        name: "AI Services",
        description: "Underlying AI service health",
        status: "operational",
        uptime: 99.72,
        items: [
          { name: "Session Prep Model", status: "operational" },
          { name: "Redaction Engine", status: "operational" },
          { name: "Risk Signals", status: "operational" },
        ],
      },
    ],
  };
}
