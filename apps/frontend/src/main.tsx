import "@fontsource-variable/inter"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { ShellDemo } from "./shell-demo"
import "./styles.css"

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ShellDemo />
    </StrictMode>,
)
