import { useState } from "react";
import { IVendorData } from "@config/types";
import { mergeVendorTheme } from "@config/merge-vendor-theme";
import { configService } from "@pages/background/services/config";
import { default as defaultVendor } from "@src/config/vendor.json";

export function useVendorTheme() {
  const [vendorData, setVendorData] = useState<IVendorData>(() =>
    mergeVendorTheme(defaultVendor as IVendorData)
  );

  const checkIfVendorDataExists = async () => {
    const resp = await configService.getAgentAndVendorInfo();
    if (resp.vendorData) {
      setVendorData(mergeVendorTheme(resp.vendorData));
    }
  };

  return { vendorData, checkIfVendorDataExists };
}
