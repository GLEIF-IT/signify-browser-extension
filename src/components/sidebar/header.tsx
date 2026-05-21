import { Box, Subtext } from "@components/ui";
import { styled } from "styled-components";

interface IHeader {
  title?: string;
  logo?: string;
  docsUrl?: string;
}

const StyledLogoLink = styled.a`
  display: flex;
  align-items: center;
  column-gap: 10px;
  text-decoration-line: none;
  border-radius: 10px;
  padding: 4px 2px;
  margin: -4px -2px;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.92;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme?.colors?.primary};
    outline-offset: 2px;
  }

  & > img {
    height: 34px;
    width: auto;
    border-radius: 8px;
  }

  & > span {
    align-self: center;
    font-size: 18px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
`;

export function Header(props: IHeader): JSX.Element {
  const href =
    props.docsUrl?.trim() ||
    "https://www.gleif.org/en/vlei/introducing-the-verifiable-lei-vlei";
  return (
    <Box>
      <StyledLogoLink
        target="_blank"
        rel="noopener noreferrer"
        href={href}
        title={props.title}
      >
        <img src={props?.logo} alt="" width={34} height={34} />
        <Subtext $color="subtext">{props?.title}</Subtext>
      </StyledLogoLink>
    </Box>
  );
}
