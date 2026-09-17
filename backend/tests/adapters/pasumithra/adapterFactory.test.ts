import { describe, expect, it } from "vitest";
import { getPasumithraAdapter } from "../../../src/integrations/adapters/pasumithra/index.js";
import { PasumithraAdapter } from "../../../src/integrations/adapters/pasumithra/pasumithraAdapter.js";

describe("Pasumithra adapter initialization", () => {
  it("getPasumithraAdapter() returns a PasumithraAdapter instance", () => {
    expect(getPasumithraAdapter()).toBeInstanceOf(PasumithraAdapter);
  });

  it("getPasumithraAdapter() returns the same singleton on repeated calls", () => {
    expect(getPasumithraAdapter()).toBe(getPasumithraAdapter());
  });

  it("getInfo() reports the correct static metadata", () => {
    expect(getPasumithraAdapter().getInfo()).toEqual({ slug: "pasumithra", name: "Pasumithra" });
  });
});
