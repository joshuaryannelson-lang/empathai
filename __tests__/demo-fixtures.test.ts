// __tests__/demo-fixtures.test.ts
import {
  DEMO_PRACTICE,
  DEMO_PRACTICES,
  DEMO_THERAPISTS,
  DEMO_PATIENTS,
  getDemoTherapistName,
} from "@/lib/demo-fixtures";
import * as fs from "fs";
import * as path from "path";

function globFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "__tests__") {
        results.push(...globFiles(full, exts));
      } else if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

describe("demo-fixtures", () => {
  it("exports valid practice data", () => {
    expect(DEMO_PRACTICE.id).toBe("demo-practice-01");
    expect(DEMO_PRACTICE.name).toBeTruthy();
    expect(DEMO_PRACTICES.length).toBeGreaterThanOrEqual(1);
  });

  it("exports valid therapist data", () => {
    expect(DEMO_THERAPISTS.length).toBeGreaterThanOrEqual(3);
    for (const t of DEMO_THERAPISTS) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
    }
  });

  it("exports valid patient data with first names only", () => {
    expect(DEMO_PATIENTS.length).toBeGreaterThanOrEqual(12);
    for (const p of DEMO_PATIENTS) {
      expect(p.firstName).toBeTruthy();
      // No spaces = no last names
      expect(p.firstName).not.toContain(" ");
    }
  });

  it("getDemoTherapistName returns correct name", () => {
    expect(getDemoTherapistName("demo-therapist-01")).toBe("Dr. Maya Chen");
    expect(getDemoTherapistName("unknown")).toBe("Demo Therapist");
  });

  it("no app/ files (excluding tests and demo-fixtures itself) hardcode demo therapist names", () => {
    const therapistNames = DEMO_THERAPISTS.map(t => t.name);
    const root = path.resolve(__dirname, "..");
    const appFiles = globFiles(path.join(root, "app"), [".ts", ".tsx"]);

    const violations: string[] = [];

    for (const file of appFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const name of therapistNames) {
        if (content.includes(name)) {
          const rel = path.relative(root, file);
          violations.push(`${rel} contains "${name}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
