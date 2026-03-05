import { scrubPrompt, scrubOutput } from "../lib/services/redaction";

describe("scrubPrompt", () => {
  it("happy path: redacts emails, phones, and known names", () => {
    const input = "Patient John Smith (john@example.com, 555-123-4567) scored 3/10 this week.";
    const result = scrubPrompt(input, ["John Smith"]);
    expect(result.text).toBe("Patient [NAME] ([EMAIL], [PHONE]) scored 3/10 this week.");
    expect(result.redactions).toContain("NAME");
    expect(result.redactions).toContain("EMAIL");
    expect(result.redactions).toContain("PHONE");
  });

  it("returns clean input unchanged", () => {
    const input = "Active caseload: 12 patients. Average score: 6.5 out of 10.";
    const result = scrubPrompt(input);
    expect(result.text).toBe(input);
    expect(result.redactions).toHaveLength(0);
  });

  it("edge case: redacts a name embedded mid-sentence", () => {
    const input = "This week, Maria Garcia showed improvement in sleep patterns and engagement.";
    const result = scrubPrompt(input, ["Maria Garcia"]);
    expect(result.text).toBe("This week, [NAME] showed improvement in sleep patterns and engagement.");
    expect(result.redactions).toEqual(["NAME"]);
  });

  it("redacts DOB patterns", () => {
    const result = scrubPrompt("Born 03/15/1990, started treatment.");
    expect(result.text).toBe("Born [DOB], started treatment.");
    expect(result.redactions).toContain("DOB");
  });

  it("redacts addresses", () => {
    const result = scrubPrompt("Lives at 123 Main Street, Apt 4B.");
    expect(result.text).toContain("[ADDRESS]");
  });
});

describe("scrubOutput", () => {
  it("flags output containing PII as blocked", () => {
    const output = "Follow up with Sarah Johnson about her sleep patterns.";
    const result = scrubOutput(output, ["Sarah Johnson"]);
    expect(result.blocked).toBe(true);
    expect(result.text).toBe("Follow up with [NAME] about her sleep patterns.");
    expect(result.redactions).toContain("NAME");
  });

  it("passes clean output through unblocked", () => {
    const output = "The patient's engagement scores improved this week. Consider reinforcing coping strategies.";
    const result = scrubOutput(output);
    expect(result.blocked).toBe(false);
    expect(result.text).toBe(output);
    expect(result.redactions).toHaveLength(0);
  });
});
