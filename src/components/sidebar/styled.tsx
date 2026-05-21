import { styled } from "styled-components";
import { Flex } from "@components/ui";

interface IStyledMenu {
  $isActive?: boolean;
}

export const StyledMenu = styled(Flex)<IStyledMenu>`
  cursor: pointer;
  color: ${({ $isActive, theme }) =>
    $isActive
      ? theme?.colors?.subtext
      : theme?.colors?.sidebarMuted ?? "rgba(255,255,255,0.72)"};
  background-color: ${({ $isActive, theme }) =>
    $isActive ? "rgba(255,255,255,0.1)" : "transparent"};
  border: 1px solid
    ${({ $isActive, theme }) =>
      $isActive ? "rgba(255,255,255,0.14)" : "transparent"};
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: ${({ theme }) => theme?.colors?.subtext};
  }
`;

export const StyledSidebar = styled.aside`
  position: fixed;
  left: 0px;
  z-index: 40;
  width: 192px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme?.colors?.secondary};
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 4px 0 24px rgba(4, 30, 58, 0.12);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  transform: translate(-100%, 0) rotate(0) skewX(0) skewY(0) scaleX(1) scaleY(1);
  @media (min-width: 640px) {
    transform: translate(0, 0) rotate(0) skewX(0) skewY(0) scaleX(1) scaleY(1);
  }
`;

export const StyledBottomMenu = styled(Flex)`
  cursor: pointer;
  color: ${({ theme }) =>
    theme?.colors?.sidebarMuted ?? "rgba(255,255,255,0.72)"};
  transition: background-color 0.15s ease, color 0.15s ease;
  &:hover {
    background-color: rgba(196, 18, 48, 0.18);
    color: ${({ theme }) => theme?.colors?.subtext};
  }
`;

export const StyledHeaderContainer = styled.ul`
  margin: 0;
`;

export const StyledLiContainer = styled.li<{ disabled?: boolean }>`
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
`;
