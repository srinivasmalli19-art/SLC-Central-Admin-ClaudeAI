import { describe, expect, it } from "vitest";
import { getJeevaMitraAdapter } from "../../../src/integrations/adapters/jeevamitra/index.js";
import { JeevaMitraAdapter } from "../../../src/integrations/adapters/jeevamitra/jeevamitraAdapter.js";

describe("JeevaMitra adapter initialization", () => {
  it("getJeevaMitraAdapter() returns a JeevaMitraAdapter instance", () => {
    expect(getJeevaMitraAdapter()).toBeInstanceOf(JeevaMitraAdapter);
  });

  it("getJeevaMitraAdapter() returns the same singleton on repeated calls", () => {
    expect(getJeevaMitraAdapter()).toBe(getJeevaMitraAdapter());
  });

  it("getInfo() reports the correct static metadata", () => {
    expect(getJeevaMitraAdapter().getInfo()).toEqual({ slug: "jeevamitra", name: "JeevaMitra" });
  });
});
