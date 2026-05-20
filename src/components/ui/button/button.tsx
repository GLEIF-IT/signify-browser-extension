import { styled, css } from "styled-components";
import { buttonStyle, ButtonStyleProps } from "styled-system";
import { Loader } from "../loader";

interface IButton {
  type?: "button" | "reset" | "submit" | undefined;
  handleClick?: (e?: any) => void;
  isLoading?: boolean;
  children?: JSX.Element | any;
  disabled?: boolean;
  testid?: string;
}

type TNewButtonCustomProps = {
  $cursorPointer?: boolean;
  $underline?: boolean;
  $hoverUnderline?: boolean;
};

const StyledButton = styled.button`
  border: none;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  background-color: ${(props) =>
    props.disabled
      ? props.theme?.colors?.muted ?? "#9BAEC2"
      : props.theme?.colors?.primary};
  text-align: center;
  font-weight: 600;
  border-radius: 10px;
  color: ${(props) =>
    props.disabled
      ? props.theme?.colors?.white
      : props.theme?.colors?.onPrimary ?? props.theme?.colors?.white};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  line-height: 20px;
  padding: 10px 18px;
  min-height: 40px;
  transition: background-color 0.15s ease, transform 0.1s ease,
    box-shadow 0.15s ease;
  box-shadow: ${(props) =>
    props.disabled
      ? "none"
      : "0 1px 2px rgba(0, 61, 165, 0.2), 0 2px 8px rgba(0, 61, 165, 0.15)"};
  &:hover:not(:disabled) {
    filter: brightness(1.06);
  }
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

const CustomButton = styled.button<ButtonStyleProps & TNewButtonCustomProps>`
  ${buttonStyle}
  height: fit-content;
  background: none;
  color: inherit;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  outline: inherit;
  ${({ $underline }) =>
    $underline &&
    css`
      text-decoration-line: underline;
    `}
  ${({ $hoverUnderline }) =>
    $hoverUnderline &&
    css`
      &:hover {
        text-decoration-line: underline;
      }
    `}  
  ${({ $cursorPointer }) =>
    $cursorPointer &&
    css`
      cursor: pointer;
    `}
`;

export const IconButton = styled.button<ButtonStyleProps>`
  ${buttonStyle}
  height: fit-content;
  background: none;
  color: inherit;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  outline: inherit;
`;

const determineElementType = (as: string) => {
  switch (as) {
    case "button":
      return "button";
    case "a":
      return "a";
    default:
      return "div"; // Default to a div if "as" prop is not recognized
  }
};

export const NewButton = styled(CustomButton).attrs((props: any) => ({
  as: determineElementType(props.as || "button"),
}))``;

export function Button(props: IButton): JSX.Element {
  return (
    <StyledButton
      disabled={props.disabled}
      type={props.type}
      onClick={props.handleClick}
      data-testid={props.testid}
    >
      {props.isLoading ? <Loader size={4} /> : null}
      {props.children}
    </StyledButton>
  );
}
