import { Toaster } from "react-hot-toast";
import { createGlobalStyle } from "styled-components";
import { ThemeProvider, styled } from "styled-components";
import { LocaleProvider } from "@src/_locales";
import { useVendorTheme } from "@config/useVendorTheme";
import { usePopup } from "./usePopup";
import { Permission } from "@src/screens/permission";
import { Signin } from "@src/screens/signin";
import { Signup } from "@src/screens/signup";
import { Loader, Box } from "@components/ui";
import { Main } from "@components/main";

export const GlobalStyles = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #__root {
    height: 100%;
    min-height: 386px;
  }

  body {
    font-family: "Facundo", "Calibri", system-ui, -apple-system, "Segoe UI",
               "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.4;
    letter-spacing: 0.01em;
    background: ${({ theme }) => theme?.colors?.bodyBg};
    color: ${({ theme }) => theme?.colors?.black};
    border: ${({ theme }) =>
      `1px solid ${theme?.colors?.bodyBorder ?? theme?.colors?.bodyBg}`};
    transition: background 0.2s ease-in, color 0.2s ease-in;
  }

  :root {
    --toast-surface: ${({ theme }) => theme?.colors?.secondary ?? "#027361"};
    --toast-on-surface: ${({ theme }) => theme?.colors?.subtext ?? "#fff"};
  }

  *:focus-visible {
    outline: 2px solid ${({ theme }) => theme?.colors?.primary};
    outline-offset: 2px;
  }

  ul {
    list-style-type: none;
    padding: 0;

    > li {
      margin-bottom: 8px;
    }
  }
`;

const StyledLoaderBox = styled(Box)`
  color: ${(props) => props.theme?.colors?.accent ?? props.theme?.colors?.primary};
`;

export default function Popup(): JSX.Element {
  const { vendorData, loadVendorData } = useVendorTheme();
  const {
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
  } = usePopup(loadVendorData);

  const logo = vendorData?.logo ?? "/vlei-wallet-extension-logo.svg";
  return (
    <LocaleProvider>
      <ThemeProvider theme={vendorData?.theme}>
        <GlobalStyles />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "12px",
              background: "var(--toast-surface)",
              color: "var(--toast-on-surface)",
            fontFamily: '"Facundo", "Calibri", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
            fontSize: "14px",
            boxShadow: "0 8px 24px rgba(0, 51, 54, 0.25)",
            },
          }}
        />
        <div>
          {isCheckingInitialConnection ? (
            <Box width="300px">
              <StyledLoaderBox margin="auto" width={64} height={64}>
                <Loader size={12} />
              </StyledLoaderBox>
            </Box>
          ) : (
            <>
              {permissionData ? (
                <Box width="300px">
                  <Permission
                    isConnected={isConnected}
                    permissionData={permissionData}
                    afterCallback={() => {
                      loadVendorData();
                      checkWebRequestedPermissions();
                    }}
                    handleDisconnect={handleDisconnectPermission}
                  />
                </Box>
              ) : showSignup ? (
                <Box width="300px">
                  <Signup
                    isLoading={isLoading}
                    handleBootAndConnect={handleBootAndConnect}
                    signupError={connectError}
                  />
                </Box>
              ) : (
                <>
                  {isConnected ? (
                    <Main
                      handleDisconnect={handleDisconnect}
                      logo={logo}
                      title={vendorData?.title}
                      docsUrl={vendorData?.docsUrl}
                    />
                  ) : (
                    <Box width="300px">
                      <Signin
                        signinError={connectError}
                        handleConnect={handleConnect}
                        isLoading={isLoading}
                        logo={logo}
                        title={vendorData?.title}
                        afterSetUrl={loadVendorData}
                        vendorData={vendorData}
                        showConfig={showConfig}
                        setShowConfig={setShowConfig}
                        handleSignup={() => setShowSignup(true)}
                      />
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </ThemeProvider>
    </LocaleProvider>
  );
}
