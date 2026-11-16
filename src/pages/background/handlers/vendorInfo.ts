import { configService } from "@pages/background/services/config";
import { IHandler } from "@config/types";

export async function handleGetVendorData({ sendResponse }: IHandler) {
  const vendorData = await configService.getVendorData();
  sendResponse({ data: { vendorData } });
}
