import { styled } from "styled-components";
import { Box } from "../box";

interface ICard {
  children?: JSX.Element;
}

const StyledCard = styled(Box)`
  border: 1px solid
    ${(props) => props.theme?.colors?.border ?? props.theme?.colors?.bodyBorder};
  background-color: ${(props) => props.theme?.colors?.cardBg};
  color: ${(props) => props.theme?.colors?.cardColor};
  box-shadow: 0 1px 2px rgba(4, 30, 58, 0.04), 0 4px 16px rgba(4, 30, 58, 0.06);
`;

export function Card({ children }: ICard): JSX.Element {
  return (
    <StyledCard
      margin="auto"
      maxWidth="384px"
      paddingX={3}
      paddingY={2}
      borderRadius="12px"
    >
      {children}
    </StyledCard>
  );
}
