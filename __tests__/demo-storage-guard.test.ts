// __tests__/demo-storage-guard.test.ts

// Mock window + localStorage before importing module
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

// In node test env, window is undefined. Define it so clearDemoStorage works.
(global as any).window = global;
Object.defineProperty(global, "localStorage", { value: mockLocalStorage, writable: true });

import { DEMO_STORAGE_KEYS, clearDemoStorage } from "@/lib/demo";

describe("clearDemoStorage", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it("removes all DEMO_STORAGE_KEYS from localStorage", () => {
    // Populate all demo keys
    for (const key of DEMO_STORAGE_KEYS) {
      localStorage.setItem(key, "test-value");
    }
    // Add a non-demo key that should survive
    localStorage.setItem("non_demo_key", "should-remain");

    clearDemoStorage();

    // All demo keys should be gone
    for (const key of DEMO_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    // Non-demo key should remain
    expect(localStorage.getItem("non_demo_key")).toBe("should-remain");
  });

  it("does not throw when localStorage is empty", () => {
    expect(() => clearDemoStorage()).not.toThrow();
  });

  it("DEMO_STORAGE_KEYS includes all known demo keys", () => {
    // These are the keys set in app/demo/page.tsx auth functions
    const expectedKeys = [
      "empathai_demo",
      "selected_persona",
      "selected_practice_id",
      "selected_therapist_id",
      "selected_manager_mode",
      "portal_token",
      "portal_case_code",
      "portal_label",
      "patient_case_id",
      "patient_name",
      "patient_id",
    ];

    for (const key of expectedKeys) {
      expect(DEMO_STORAGE_KEYS).toContain(key);
    }
  });
});
