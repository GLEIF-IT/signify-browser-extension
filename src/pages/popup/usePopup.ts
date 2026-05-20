import { useCallback, useEffect, useState } from "react";
import { UI_EVENTS } from "@config/event-types";
import { sendMessage } from "@src/shared/browser/runtime-utils";
import { sendMessageTab, getCurrentTab } from "@src/shared/browser/tabs-utils";
import {
  WEB_APP_PERMS,
  configService,
} from "@pages/background/services/config";
import { isValidUrl } from "@shared/utils";
interface IBootAndConnect {
  passcode?: string;
  agentUrl?: string;
  bootUrl: string;
}

interface IConnect {
  passcode?: string;
  agentUrl?: string;
}

export function usePopup(
  loadVendorData: () => Promise<any>
) {
  const [showConfig, setShowConfig] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [permissionData, setPermissionData] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [isCheckingInitialConnection, setIsCheckingInitialConnection] =
    useState(false);

  const checkWebRequestedPermissions = useCallback(async () => {
    const webRequestedPermissions =
      await configService.getWebRequestedPermissions();
    const requestedVendorUrlChange =
      webRequestedPermissions[WEB_APP_PERMS.SET_VENDOR_URL];
    setPermissionData(requestedVendorUrlChange);
  }, []);

  const checkConnection = useCallback(async () => {
    const { data } = await sendMessage({
      type: UI_EVENTS.authentication_check_agent_connection,
    });
    setIsConnected(!!data.isConnected);
    if (data.isConnected) {
      try {
        const tab = await getCurrentTab();
        const { data: tabData } = await sendMessageTab(tab.id!, {
          type: "tab",
          subtype: "get-tab-state",
        });
        sendMessageTab(tab.id!, {
          type: "tab",
          subtype: "reload-state",
          eventType: tabData?.tabState,
        });
      } catch (error) {
        console.log("Error in popup from sendMessageTab", error);
      }
    }
  }, []);

  const checkInitialConnection = useCallback(async () => {
    setIsCheckingInitialConnection(true);
    await checkWebRequestedPermissions();
    await checkConnection();
    setIsCheckingInitialConnection(false);
  }, [checkWebRequestedPermissions, checkConnection]);

  useEffect(() => {
    (async () => {
      const resp = await loadVendorData();
      if (!resp?.agentUrl || !resp?.hasOnboarded) {
        setShowConfig(true);
      }
    })();
    checkInitialConnection();
  }, [loadVendorData, checkInitialConnection]);

  const handleBootAndConnect = useCallback(
    async (passcode: string) => {
      const agentUrl = await configService.getAgentUrl();
      const bootUrl = await configService.getBootUrl();
      const urlObject = isValidUrl(agentUrl);

      if (!urlObject || !urlObject?.origin) return;
      setIsLoading(true);

      const { error } = await sendMessage<IBootAndConnect>({
        type: UI_EVENTS.authentication_boot_connect_agent,
        data: {
          passcode,
          agentUrl,
          bootUrl,
        },
      });

      setIsLoading(false);
      if (error) {
        setConnectError(error?.message);
        setTimeout(() => {
          setConnectError("");
        }, 3000);
      } else {
        setShowSignup(false);
        await checkConnection();
      }
    },
    [checkConnection]
  );

  const handleConnect = useCallback(
    async (passcode: string) => {
      setIsLoading(true);
      const agentUrl = await configService.getAgentUrl();
      const { error } = await sendMessage<IConnect>({
        type: UI_EVENTS.authentication_connect_agent,
        data: {
          passcode,
          agentUrl,
        },
      });

      setIsLoading(false);
      if (error) {
        setConnectError(error?.message);
        setTimeout(() => {
          setConnectError("");
        }, 3000);
      } else {
        await checkConnection();
      }
    },
    [checkConnection]
  );

  const handleDisconnect = useCallback(async () => {
    await sendMessage({
      type: UI_EVENTS.authentication_disconnect_agent,
    });
    await checkConnection();
  }, [checkConnection]);

  const handleDisconnectPermission = useCallback(async () => {
    await sendMessage({
      type: UI_EVENTS.authentication_disconnect_agent,
    });
    await checkConnection();
    await Promise.all([loadVendorData(), checkWebRequestedPermissions()]);
  }, [checkConnection, loadVendorData, checkWebRequestedPermissions]);

  return {
    showConfig,
    setShowConfig,
    showSignup,
    setShowSignup,
    permissionData,
    isConnected,
    isLoading,
    connectError,
    isCheckingInitialConnection,
    checkWebRequestedPermissions,
    handleBootAndConnect,
    handleConnect,
    handleDisconnect,
    handleDisconnectPermission,
  };
}
