import { getConfigEntry } from "../../data/config_entries";
import type { DataEntryFlowStep } from "../../data/data_entry_flow";
import type { DeviceRegistryEntry } from "../../data/device/device_registry";
import type { HomeAssistant } from "../../types";

export const getConfigFlowDevices = (
  showDevices: boolean,
  devices: DeviceRegistryEntry[],
  entryId?: string,
  carryOverDevices?: string[],
  subentryId?: string,
  showDeviceSetup = false
): DeviceRegistryEntry[] => {
  if (!showDevices || !entryId) {
    return [];
  }
  if (showDeviceSetup && subentryId) {
    return devices.filter((device) =>
      device.config_entries_subentries[entryId]?.includes(subentryId)
    );
  }
  return devices.filter(
    (device) =>
      device.config_entries.includes(entryId) ||
      carryOverDevices?.includes(device.id)
  );
};

export const resolveCreatedSubentry = async (
  callWS: HomeAssistant["callWS"],
  step: DataEntryFlowStep
): Promise<DataEntryFlowStep> => {
  if (
    (step.type !== "create_entry" && step.type !== "abort") ||
    step.show_device_setup !== true ||
    !step.created_subentry
  ) {
    return step;
  }
  const { config_entry } = await getConfigEntry(
    callWS,
    step.created_subentry.entry_id
  );
  return {
    ...step,
    type: "create_entry",
    result: config_entry,
    description: null,
  };
};
