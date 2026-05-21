import defaultVendor from "@config/vendor.json";
import { IVendorData } from "@config/types";

/**
 * Merges bundled defaults with vendor-provided theme so partial themes from
 * remote config still render with a complete vLEI-style palette.
 */
export function mergeVendorTheme(vendor: IVendorData): IVendorData {
  const base = defaultVendor as IVendorData;
  return {
    ...base,
    ...vendor,
    theme: {
      colors: {
        ...base.theme.colors,
        ...(vendor.theme?.colors ?? {}),
      },
    },
  };
}
