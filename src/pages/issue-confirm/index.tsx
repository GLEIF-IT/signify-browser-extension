import { createRoot } from "react-dom/client";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/source-sans-3/latin-700.css";
import "./index.css";
import { IssueConfirm } from "./IssueConfirm";

const rootContainer = document.querySelector("#__root");
if (!rootContainer) throw new Error("Can't find issue-confirm root element");
createRoot(rootContainer).render(<IssueConfirm />);
