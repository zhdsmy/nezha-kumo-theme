import { type CSSProperties, useContext } from "react"

import type { PageProps } from "./contract"
import { AsideLabelContext } from "./shell"

export function Page({
    title,
    description,
    eyebrow,
    actions,
    tabs,
    aside,
    maxWidth,
    children,
}: PageProps) {
    const asideLabel = useContext(AsideLabelContext)
    return (
        <div
            className={`nk-page${aside ? " nk-page-with-aside" : ""}`}
            style={
                maxWidth === undefined
                    ? undefined
                    : ({ "--nk-page-max": `${maxWidth}px` } as CSSProperties)
            }
        >
            <div className="nk-page-main">
                <div className="nk-page-inner">
                    <div className="nk-page-heading">
                        {eyebrow && <div className="nk-page-eyebrow">{eyebrow}</div>}
                        <div className="nk-page-title-row">
                            <div className="nk-page-title-body">
                                <h1 title={typeof title === "string" ? title : undefined}>
                                    {title}
                                </h1>
                                {description && (
                                    <div
                                        className="nk-page-description"
                                        title={
                                            typeof description === "string"
                                                ? description
                                                : undefined
                                        }
                                    >
                                        {description}
                                    </div>
                                )}
                            </div>
                            {actions && <div className="nk-page-actions">{actions}</div>}
                        </div>
                    </div>
                    {tabs && <div className="nk-page-tabs">{tabs}</div>}
                    <div className="nk-page-content">{children}</div>
                </div>
            </div>
            {aside && (
                <aside className="nk-page-aside" aria-label={asideLabel}>
                    {aside}
                </aside>
            )}
        </div>
    )
}
