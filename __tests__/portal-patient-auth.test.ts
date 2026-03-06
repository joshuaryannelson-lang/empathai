// __tests__/portal-patient-auth.test.ts
// Suite 3 (partial): Patient JWT auth — mint, verify, extract
// Tests cover the patientAuth module directly (no mocking needed — pure crypto)

import { TEST_CASE_CODE_A, TEST_CASE_CODE_B } from "@/lib/fixtures/portalTestData";

// Set the secret before importing the module
process.env.PATIENT_JWT_SECRET = "test-secret-key-for-jwt-signing-min-32-chars!!";

import {
  mintPatientJWT,
  verifyPatientJWT,
  extractPatientToken,
  authenticatePatient,
} from "@/lib/patientAuth";

describe("Suite 3 (partial): Patient JWT Auth", () => {
  // Test 15: Mint and verify round-trip
  test("15. mint → verify round-trip returns correct claims", async () => {
    const token = await mintPatientJWT(TEST_CASE_CODE_A);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

    const claims = await verifyPatientJWT(token);
    expect(claims).not.toBeNull();
    expect(claims!.role).toBe("patient");
    expect(claims!.case_code).toBe(TEST_CASE_CODE_A);
  });

  // Test 16: Different case_codes produce different tokens
  test("16. different case_codes produce tokens with different claims", async () => {
    const tokenA = await mintPatientJWT(TEST_CASE_CODE_A);
    const tokenB = await mintPatientJWT(TEST_CASE_CODE_B);

    expect(tokenA).not.toBe(tokenB);

    const claimsA = await verifyPatientJWT(tokenA);
    const claimsB = await verifyPatientJWT(tokenB);

    expect(claimsA!.case_code).toBe(TEST_CASE_CODE_A);
    expect(claimsB!.case_code).toBe(TEST_CASE_CODE_B);
  });

  // Test 17: Tampered token fails verification
  test("17. tampered token returns null", async () => {
    const token = await mintPatientJWT(TEST_CASE_CODE_A);
    // Flip a character in the signature
    const tampered = token.slice(0, -5) + "XXXXX";
    const claims = await verifyPatientJWT(tampered);
    expect(claims).toBeNull();
  });

  // Test 18: Garbage token returns null
  test("18. garbage string returns null", async () => {
    const claims = await verifyPatientJWT("not-a-jwt");
    expect(claims).toBeNull();
  });

  // Test 19: extractPatientToken parses Bearer header
  test("19a. extractPatientToken extracts from Bearer header", () => {
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer my-token-123" },
    });
    expect(extractPatientToken(req)).toBe("my-token-123");
  });

  test("19b. extractPatientToken returns null without Bearer prefix", () => {
    const req = new Request("http://localhost", {
      headers: { Authorization: "Basic abc123" },
    });
    expect(extractPatientToken(req)).toBeNull();
  });

  test("19c. extractPatientToken returns null with no auth header", () => {
    const req = new Request("http://localhost");
    expect(extractPatientToken(req)).toBeNull();
  });

  // Test: authenticatePatient full chain
  test("19d. authenticatePatient returns claims for valid token", async () => {
    const token = await mintPatientJWT(TEST_CASE_CODE_A);
    const req = new Request("http://localhost", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const claims = await authenticatePatient(req);
    expect(claims).not.toBeNull();
    expect(claims!.case_code).toBe(TEST_CASE_CODE_A);
  });

  test("19e. authenticatePatient returns null for missing token", async () => {
    const req = new Request("http://localhost");
    const claims = await authenticatePatient(req);
    expect(claims).toBeNull();
  });
});
