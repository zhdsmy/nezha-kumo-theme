import "@fontsource-variable/inter"
import { createRoot } from "react-dom/client"

import { App } from "./app/App"
import { applyAppearance } from "./app/prefs"
import "./i18n"
import "./styles.css"

applyAppearance()
createRoot(document.getElementById("root")!).render(<App />)
