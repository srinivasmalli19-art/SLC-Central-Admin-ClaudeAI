import { afterAll, afterEach, beforeAll } from "vitest";
import { disconnectDb, ensureFixtures, resetMutableData } from "./helpers/db.js";

beforeAll(async () => {
  await resetMutableData();
  await ensureFixtures();
});

afterEach(async () => {
  await resetMutableData();
});

afterAll(async () => {
  await disconnectDb();
});
