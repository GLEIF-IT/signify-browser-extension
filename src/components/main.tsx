import { useEffect, useState } from "react";
import { styled } from "styled-components";
import { getCurrentTab, sendMessageTab } from "@src/shared/browser/tabs-utils";
import { Text, MainBox, Box } from "@components/ui";
import { Sidebar, SIDEBAR, SIDEBAR_KEYS } from "@components/sidebar";
import { SelectIdentifier } from "@components/selectIdentifier";
import { SelectCredential } from "@components/selectCredential";
import { TAB_STATE } from "@pages/popup/constants";
import { IdentifierList } from "@components/identifierList";
import { CredentialList } from "@components/credentialList";
import { SigninList } from "@components/signinList";

interface IMain {
  handleDisconnect: () => void;
  logo?: string;
  title?: string;
  docsUrl?: string;
}

const StyledMainContainer = styled(Box)`
  flex: 1;
  background-color: ${(props) =>
    props.theme?.colors?.surface ?? props.theme?.colors?.bodyBg};
  color: ${(props) => props.theme?.colors?.text};
  border: 1px solid
    ${(props) =>
      props.theme?.colors?.border ?? props.theme?.colors?.bodyBorder};
  box-shadow: 0 1px 3px rgba(4, 30, 58, 0.06);
`;

const SectionHeading = styled.div`
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid
    ${({ theme }) =>
      theme?.colors?.border ?? theme?.colors?.bodyBorder};
`;

export function Main(props: IMain): JSX.Element {
  const [activeSidebar, setActiveSidebar] = useState(SIDEBAR[0]);
  const [currentTabState, setCurrentTabState] = useState(TAB_STATE.NONE);

  const fetchTabState = async () => {
   try {
    const tab = await getCurrentTab();
    const { data } = await sendMessageTab(tab.id!, {
      type: "tab",
      subtype: "get-tab-state",
    });
    if (!data) return;

    if (data?.tabState) {
      setCurrentTabState(data?.tabState);
      if (
        data?.tabState === TAB_STATE.SELECT_IDENTIFIER ||
        data?.tabState === TAB_STATE.SELECT_CREDENTIAL ||
        data?.tabState === TAB_STATE.SELECT_ID_CRED
      ) {
        setActiveSidebar(
          data?.tabState === TAB_STATE.SELECT_IDENTIFIER ||
            data?.tabState === TAB_STATE.SELECT_ID_CRED
            ? SIDEBAR[0]
            : SIDEBAR[1]
        );
      }
      if (data?.tabState === TAB_STATE.SELECT_AUTO_SIGNIN) {
        setActiveSidebar(SIDEBAR[2]);
      }
    }
   } catch (error) {
    console.log("Error fetching tab state", error);
   }
  };

  useEffect(() => {
    fetchTabState();
  }, []);

  const renderItems = () => {
    switch (activeSidebar?.id) {
      case SIDEBAR_KEYS.credentials:
        if (
          currentTabState === TAB_STATE.SELECT_CREDENTIAL ||
          currentTabState === TAB_STATE.SELECT_ID_CRED
        )
          return <SelectCredential />;

        return <CredentialList />;
      case SIDEBAR_KEYS.signin:
        return <SigninList />;

      default:
        if (
          currentTabState === TAB_STATE.SELECT_IDENTIFIER ||
          currentTabState === TAB_STATE.SELECT_ID_CRED
        )
          return <SelectIdentifier />;

        return <IdentifierList />;
    }
  };

  return (
    <MainBox width="640px" minHeight="640px" display="flex">
      <Sidebar
        active={activeSidebar}
        onClickLink={setActiveSidebar}
        onSignout={props.handleDisconnect}
        logo={props?.logo}
        title={props?.title}
        docsUrl={props.docsUrl}
      />
      <StyledMainContainer
        padding={3}
        borderRadius="12px"
        marginRight={3}
        marginTop={3}
        marginBottom={3}
        marginLeft="192px"
      >
        <div>
          <SectionHeading>
            <Text fontSize={3} fontWeight="700" $color="heading" $capitalize>
              {activeSidebar?.title}
            </Text>
          </SectionHeading>
          <Box marginTop={3} maxHeight="560px" overflow="auto">
            {renderItems()}
          </Box>
        </div>
      </StyledMainContainer>
    </MainBox>
  );
}
