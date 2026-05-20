import browser from "webextension-polyfill";
import { SignifyClient, Tier, ready, randomPasscode } from "signify-ts";
import { sendMessage } from "@src/shared/browser/runtime-utils";
import { userService } from "@pages/background/services/user";
import { configService } from "@pages/background/services/config";
import { SW_EVENTS } from "@config/event-types";

export const PASSCODE_TIMEOUT = 5;

let _client: SignifyClient | null = null;

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name == "passcode-timeout") {
    try {
      const response = await sendMessage({
        type: SW_EVENTS.check_popup_open,
      });
      if (response.data.isOpened) {
        console.log("Timer expired, but extension is open. Resetting timer.");
        resetTimeoutAlarm();
      }
    } catch (error) {
      console.log("Timer expired, client and passcode zeroed out");
      _client = null;
      await userService.removeControllerId();
      await userService.removePasscode();
    }
  }
});

const setTimeoutAlarm = () => {
  browser.alarms.create("passcode-timeout", {
    delayInMinutes: PASSCODE_TIMEOUT,
  });
};

export const resetTimeoutAlarm = async () => {
  await browser.alarms.clear("passcode-timeout");
  setTimeoutAlarm();
};

export function getClient(): SignifyClient | null {
  return _client;
}

export function validateClient(): void {
  if (!_client) {
    throw new Error("Signify Client not connected");
  }
}

const getState = async () => {
  validateClient();
  return await _client?.state();
};

const generatePasscode = () => {
  return randomPasscode();
};

const bootAndConnect = async (
  agentUrl: string,
  bootUrl: string,
  passcode: string
) => {
  try {
    await ready();
    _client = new SignifyClient(agentUrl, passcode, Tier.low, bootUrl);
    await _client.boot();
    await _client.connect();
    const state = await getState();
    await userService.setControllerId(state?.controller?.state?.i);
    setTimeoutAlarm();
  } catch (error) {
    console.error(error);
    _client = null;
    return { error };
  }
};

const connect = async (agentUrl: string, passcode: string) => {
  try {
    await ready();
    _client = new SignifyClient(agentUrl, passcode, Tier.low);
    await _client.connect();
    const state = await getState();
    await userService.setControllerId(state?.controller?.state?.i);
    setTimeoutAlarm();
  } catch (error) {
    console.error(error);
    _client = null;
    return { error };
  }
};

export const isConnected = async () => {
  const passcode = await userService.getPasscode();
  const url = await configService.getAgentUrl();
  if (url && passcode && !_client) {
    await connect(url, passcode);
    await resetTimeoutAlarm();
  }

  try {
    const state = await getState();
    console.log("Signify client is connected", _client);
    return _client && state?.controller?.state?.i ? true : false;
  } catch (error) {
    console.log(
      _client
        ? "Signify client is not valid, unable to connect"
        : "Signify client is not connected",
      _client
    );
    return false;
  }
};

const disconnect = async () => {
  _client = null;
  await userService.removeControllerId();
  await userService.removePasscode();
};

const getControllerID = async (): Promise<string> => {
  validateClient();
  const controllerId = await userService.getControllerId();
  return controllerId;
};

export const signifyConnectionService = {
  connect,
  isConnected,
  disconnect,
  generatePasscode,
  bootAndConnect,
  getControllerID,
  getClient,
};
