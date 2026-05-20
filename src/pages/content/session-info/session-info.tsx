import browser from "webextension-polyfill";
import { useState, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { sendMessage } from "@src/shared/browser/runtime-utils";
import { CS_EVENTS } from "@config/event-types";
import { ThemeProvider, styled } from "styled-components";
import { useIntl } from "react-intl";
import { Text, Box, Flex, IconButton, Subtext } from "@components/ui";
import { IVendorData, ISignin } from "@config/types";
import { mergeVendorTheme } from "@config/merge-vendor-theme";

const StyledMain = styled(Box)`
  border: ${(props) =>
    `1px solid ${
      props.theme?.colors?.border ?? props.theme?.colors?.bodyBorder
    }`};
  background: ${(props) =>
    props.theme?.colors?.surface ?? props.theme?.colors?.bodyBg};
  color: ${(props) => props.theme?.colors?.black};
  opacity: 0.5;
  display: flex;
  flex-direction: row;
  align-items: center;
  column-gap: 4px;
  &:hover {
    opacity: 1;
    #details {
      display: flex;
    }
  }
  #details {
    display: none;
  }
`;

const StyledTimer = styled(Box)`
  border: ${(props) =>
    `1px solid ${
      props.theme?.colors?.border ?? props.theme?.colors?.bodyBorder
    }`};
  background: ${(props) => props.theme?.colors?.cardBg};
  color: ${(props) => props.theme?.colors?.primary};
  opacity: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  column-gap: 4px;
  border-radius: 12px;
  justify-content: center;
  width: max-content;
  padding: 0 8px;
  margin: auto;
  font-size: 10px;
`;

const StyledImg = styled.img`
  height: ${({ height }) => height};
`;

interface ISessionInfo {
  isConnected: boolean;
  vendorData: IVendorData;
}

export function SessionInfo({
  vendorData,
  data,
  handleRemove,
}: ISessionInfo): JSX.Element {
  const { formatMessage } = useIntl();
  const [showDetails, setShowDetails] = useState(false);
  const [mins, setMins] = useState(0);
  const [secs, setSecs] = useState(0);
  const [sessionInterval, setSessionInterval] = useState(null);

  const [position, setPosition] = useState({
    left: 20,
    top: window.innerHeight - 70,
  });
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef(null);

  const onMouseDown = (e) => {
    e.preventDefault(); // Prevent default to avoid any browser drag behavior
    setIsDragging(true);
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const newLeft = e.clientX - rect.width / 2;
    const newTop = e.clientY - rect.height / 2;

    // Check if dragged to the left side
    if (e.clientX < rect.left - 50) {
      // 50px threshold to the left
      setPosition({ left: 20, top: newTop });
    } else {
      setPosition({
        left: Math.max(0, Math.min(window.innerWidth - rect.width, newLeft)),
        top: Math.max(0, Math.min(window.innerHeight - rect.height, newTop)),
      });
    }
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    } else {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    // Cleanup event listeners on component unmount
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  function showTimer(target) {
    const distance = target - new Date().getTime();
    const _mins =
      distance < 0
        ? 0
        : Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const _secs =
      distance < 0 ? 0 : Math.floor((distance % (1000 * 60)) / 1000);

    // Output the results
    setMins(_mins);
    setSecs(_secs);
  }

  const handleClearSession = async () => {
    const { data, error } = await sendMessage<{
      rurl: string;
      signin: ISignin;
    }>({
      type: CS_EVENTS.authentication_clear_session,
    });

    if (!data) {
      toast.error("Session expired");
    }
  };

  useEffect(() => {
    let _interval;
    if (!sessionInterval) {
      _interval = setInterval(function () {
        showTimer(data?.expiry);
        if (data?.expiry - new Date().getTime() < 0) {
          clearInterval(_interval);
          handleClearSession();
          setTimeout(() => {
            handleRemove();
          }, 3000);
        }
      }, 1000);
      setSessionInterval(_interval);
    }

    return () => {
      if (_interval) {
        clearInterval(_interval);
      }
    };
  }, []);
  const resolvedVendor = mergeVendorTheme(vendorData);
  const logo =
    resolvedVendor.logo ??
    browser.runtime.getURL("vlei-wallet-extension-logo.svg");

  return (
    <ThemeProvider theme={resolvedVendor.theme}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "12px",
            background: "#041E3A",
            color: "#F4F7FB",
            fontFamily: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
            fontSize: "14px",
            boxShadow: "0 8px 24px rgba(4, 30, 58, 0.25)",
          },
        }}
      />
      <Box
        position="fixed"
        $cursorPointer
        className="draggable-btn"
        // bottom="40px"
        // right="40px"
        overflow="auto"
        ref={buttonRef}
        style={{ left: position.left, top: position.top }}
        onMouseDown={onMouseDown}
      >
        <StyledMain
          data-tooltip-id="session-info"
          borderRadius="30px"
          maxWidth="300px"
          textAlign="center"
          padding={1}
        >
          <Flex flexDirection="column" $flexGap={2} alignItems="center">
            <StyledImg src={logo} height="32px" alt="" />
          </Flex>
          <Flex id="details" flexDirection="row" fontSize={0} $flexGap={1}>
            <Text $color="heading" fontWeight="600">{`${(
              data?.credential?.raw?.schema?.title ??
              data?.identifier?.prefix ??
              ""
            ).slice(0, 20)}...`}</Text>
            <StyledTimer>
              <b id="minutes">{mins}</b>
              <b>:</b>
              <b id="seconds">{secs}</b>
            </StyledTimer>
          </Flex>
        </StyledMain>
      </Box>
    </ThemeProvider>
  );
}
