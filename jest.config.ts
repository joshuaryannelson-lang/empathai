import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!jose)",
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "node_modules/jose/.+\\.js$": "ts-jest",
  },
};

export default config;
