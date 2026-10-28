import { describe, expect, it, vi } from "vitest";
import type { ConfigEntry } from "../../../src/data/config_entries";
import type { DataEntryFlowStep } from "../../../src/data/data_entry_flow";
import type { DeviceRegistryEntry } from "../../../src/data/device/device_registry";
import {
  getConfigFlowDevices,
  resolveCreatedSubentry,
} from "../../../src/dialogs/config-flow/config-flow-devices";

const device = (
  id: string,
  subentries: Record<string, (string | null)[]>
): DeviceRegistryEntry =>
  ({
    id,
    config_entries: Object.keys(subentries),
    config_entries_subentries: subentries,
  }) as DeviceRegistryEntry;

const devices = [
  device("parent", { entry: [null] }),
  device("sibling", { entry: ["existing"] }),
  device("new-child", { entry: ["new"] }),
  device("other", { unrelated: ["new"] }),
];

describe("getConfigFlowDevices", () => {
  it("isolates newly created subentry devices, including several devices", () => {
    const added = device("second-child", { entry: ["new"] });
    expect(
      getConfigFlowDevices(
        true,
        [...devices, added],
        "entry",
        ["parent"],
        "new",
        true
      ).map((d) => d.id)
    ).toEqual(["new-child", "second-child"]);
  });

  it("allows zero devices and discovers devices arriving later", () => {
    expect(
      getConfigFlowDevices(
        true,
        devices.slice(0, 2),
        "entry",
        undefined,
        "new",
        true
      )
    ).toEqual([]);
    expect(
      getConfigFlowDevices(true, devices, "entry", undefined, "new", true).map(
        (d) => d.id
      )
    ).toEqual(["new-child"]);
  });

  it.each([undefined, false])(
    "does not filter by subentry when device setup is %s",
    (showDeviceSetup) => {
      expect(
        getConfigFlowDevices(
          true,
          devices,
          "entry",
          undefined,
          "new",
          showDeviceSetup
        ).map((d) => d.id)
      ).toEqual(["parent", "sibling", "new-child"]);
    }
  );

  it("preserves parent configuration and carried-over devices", () => {
    expect(
      getConfigFlowDevices(true, devices, "entry", ["other"]).map((d) => d.id)
    ).toEqual(["parent", "sibling", "new-child", "other"]);
    expect(getConfigFlowDevices(false, devices, "entry")).toEqual([]);
    expect(getConfigFlowDevices(true, devices)).toEqual([]);
  });
});

describe("resolveCreatedSubentry", () => {
  it.each(["create_entry", "abort"] as const)(
    "uses native completion for %s with a created subentry",
    async (type) => {
      const parent = {
        entry_id: "entry",
        domain: "test",
        title: "Parent",
      } as ConfigEntry;
      const callWS = vi.fn().mockResolvedValue({ config_entry: parent });
      const step: DataEntryFlowStep =
        type === "create_entry"
          ? {
              type,
              flow_id: "flow",
              handler: "test",
              description: null,
              created_subentry: { entry_id: "entry", subentry_id: "new" },
              show_device_setup: true,
            }
          : {
              type,
              flow_id: "flow",
              handler: "test",
              reason: "child_added",
              created_subentry: { entry_id: "entry", subentry_id: "new" },
              show_device_setup: true,
            };
      expect(await resolveCreatedSubentry(callWS, step)).toMatchObject({
        type: "create_entry",
        result: parent,
        created_subentry: { entry_id: "entry", subentry_id: "new" },
      });
      expect(callWS).toHaveBeenCalledWith({
        type: "config_entries/get_single",
        entry_id: "entry",
      });
    }
  );

  describe.each([undefined, false])(
    "when device setup is %s",
    (showDeviceSetup) => {
      it.each([
        { type: "create_entry", description: null },
        { type: "abort", reason: "finished" },
      ] as const)(
        "preserves $type with subentry metadata without fetching an entry",
        async (result) => {
          const callWS = vi.fn();
          const step: DataEntryFlowStep = {
            ...result,
            flow_id: "flow",
            handler: "test",
            created_subentry: { entry_id: "entry", subentry_id: "new" },
            show_device_setup: showDeviceSetup,
          };
          expect(await resolveCreatedSubentry(callWS, step)).toBe(step);
          expect(callWS).not.toHaveBeenCalled();
        }
      );
    }
  );

  it("preserves an opted-in result without a created subentry", async () => {
    const callWS = vi.fn();
    const step: DataEntryFlowStep = {
      type: "create_entry",
      flow_id: "flow",
      handler: "test",
      description: null,
      show_device_setup: true,
    };
    expect(await resolveCreatedSubentry(callWS, step)).toBe(step);
    expect(callWS).not.toHaveBeenCalled();
  });

  it("leaves ordinary aborts unchanged without fetching an entry", async () => {
    const callWS = vi.fn();
    const step: DataEntryFlowStep = {
      type: "abort",
      flow_id: "flow",
      handler: "test",
      reason: "already_configured",
    };
    expect(await resolveCreatedSubentry(callWS, step)).toBe(step);
    expect(callWS).not.toHaveBeenCalled();
  });
});
