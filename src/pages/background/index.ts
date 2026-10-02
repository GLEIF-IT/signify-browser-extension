import browser from "webextension-polyfill";
import { configService } from "@pages/background/services/config";
import { sessionStorageService } from "@pages/background/services/browser-storage";
import { IMessage } from "@config/types";
import { senderIsIssueConfirm, senderIsPopup } from "@pages/background/utils";
import { setActionIcon } from "@shared/browser/action-utils";
import { initCSHandler, initUIHandler, initIssueConfirmHandler } from "@pages/background/handlers";

console.log("Background script loaded");

const csHandler = initCSHandler();
const uiHandler = initUIHandler();
const issueConfirmHandler = initIssueConfirmHandler();
const SAVE_TIMESTAMP_INTERVAL_MS = 2 * 1000;

function saveTimestamp() {
  const timestamp = new Date().toISOString();
  sessionStorageService.setValue("timestamp", timestamp);
}

browser.runtime.onStartup.addListener(function () {
  (async () => {
    const vendorData = await configService.getVendorData();
    if (vendorData?.icon) {
      setActionIcon(vendorData?.icon);
    }
  })();
  return true;
});

browser.runtime.onInstalled.addListener(function (object) {
  if (object.reason === "install") {
    console.log("Signify Browser Extension installed");
  }
});

browser.runtime.onMessage.addListener(function (
  message: IMessage<any>,
  sender,
  sendResponse
) {
  (async () => {
    // The issuance-confirmation window is an extension page in an active tab that is not the popup, so it
    // must be recognised first: otherwise its messages would be handled as content-script messages.
    if (senderIsIssueConfirm(sender)) {
      console.log("Message received from issue confirmation page: ", message.type);
      const processor = issueConfirmHandler.get(message.type);
      if (processor) {
        processor({
          sendResponse,
          tabId: sender?.tab?.id,
          url: sender?.url,
          data: message?.data,
        });
      }
    } else if (sender.tab && sender.tab.active && !senderIsPopup(sender)) {
      console.log("Message received from content script at ", sender?.tab?.url);
      console.log("Message Type", message.type);
      const processor = csHandler.get(message.type);
      if (processor) {
        processor({
          sendResponse,
          tabId: sender?.tab?.id,
          url: sender?.url,
          data: message?.data,
        });
      }
    } else if (senderIsPopup(sender)) {
      console.log("Message received from popup: ", message.type);
      const processor = uiHandler.get(message.type);
      if (processor) {
        processor({
          sendResponse,
          tabId: sender?.tab?.id,
          url: sender?.url,
          data: message?.data,
        });
      }
    }
  })();
  return true;
});

async function initBackground() {
  saveTimestamp();
  setInterval(saveTimestamp, SAVE_TIMESTAMP_INTERVAL_MS);
}
initBackground();
