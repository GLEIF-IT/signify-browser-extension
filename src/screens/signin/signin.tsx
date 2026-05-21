import { useState, useEffect } from "react";
import { styled } from "styled-components";
import { Button, Box, Flex, Input, Text, Card } from "@components/ui";
import { useIntl } from "react-intl";

interface ISignin {
  passcode?: string;
  signinError?: string;
  handleConnect: (passcode: string) => void;
  isLoading?: boolean;
  logo?: string;
}

const StyledLogo = styled.img`
  width: 80px;
  height: 80px;
  object-fit: contain;
`;

export function Signin(props: ISignin): JSX.Element {
  const { formatMessage } = useIntl();
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const passcodeMessage = formatMessage({ id: "account.enterPasscode" });
  const connectMessage = formatMessage({ id: "action.connect" });

  useEffect(() => {
    if (props.signinError) {
      setPasscodeError(props.signinError);
    }
  }, [props.signinError]);

  const onBlurPasscode = () => {
    if (!passcode) {
      setPasscodeError(passcodeMessage);
    } else {
      setPasscodeError("");
    }
  };

  const handleConnect = async () => {
    let hasError = false;
    if (!passcode) {
      setPasscodeError(passcodeMessage);
      hasError = true;
    }

    if (!hasError) {
      await props.handleConnect(passcode);
    }
  };

  return (
    <Card>
      <>
        <Flex flexDirection="row" justifyContent="center" marginBottom={3}>
          <StyledLogo src={props.logo} alt="" />
        </Flex>
        <Box paddingX={0} paddingY={0}>
          <Input
            type="password"
            id="passcode"
            testid="signin-passcode"
            errorTestid="signin-passcode-error"
            error={passcodeError}
            placeholder={passcodeMessage}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onBlur={onBlurPasscode}
          />
        </Box>
        <Flex flexDirection="row" justifyContent="center" marginTop={3}>
          <Button
            testid="signin-connect"
            handleClick={handleConnect}
            isLoading={props.isLoading}
          >
            <Text $color="onPrimary">{connectMessage}</Text>
          </Button>
        </Flex>
      </>
    </Card>
  );
}
