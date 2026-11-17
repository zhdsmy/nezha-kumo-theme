"use client"

import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatPath } from "@/lib/utils"
import { Dispatch, FC, Fragment, SetStateAction, useState } from "react"
import { useTranslation } from "react-i18next"

const ITEMS_TO_DISPLAY = 3

interface FilepathProps {
    path: string
    setPath: Dispatch<SetStateAction<string>>
}

function pathToItems(path: string) {
    const segments = path.split("/").filter(Boolean)

    const result: { href: string; label: string }[] = []

    let currentPath = ""
    segments.forEach((segment) => {
        currentPath += `/${segment}`
        result.push({ href: currentPath, label: segment })
    })

    return result
}

export const Filepath: FC<FilepathProps> = ({ path, setPath }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const items = pathToItems(formatPath(path))

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <p
                        className="cursor-pointer hover:text-foreground transition"
                        onClick={() => {
                            setPath("/")
                        }}
                    >
                        /
                    </p>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                {items.length > ITEMS_TO_DISPLAY ? (
                    <>
                        <BreadcrumbItem>
                            {
                                <DropdownMenu open={open} onOpenChange={setOpen}>
                                    <DropdownMenuTrigger
                                        className="flex items-center gap-1"
                                        aria-label={t("ToggleMenu")}
                                    >
                                        <BreadcrumbEllipsis className="h-4 w-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        {items.slice(0, -ITEMS_TO_DISPLAY).map((item, index) => (
                                            <DropdownMenuItem key={index}>
                                                <p
                                                    onClick={() => {
                                                        setPath(item.href)
                                                    }}
                                                >
                                                    {item.label}
                                                </p>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            }
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                    </>
                ) : null}
                {items.slice(-ITEMS_TO_DISPLAY).map((item, index, slicedItems) => (
                    <Fragment key={index}>
                        <BreadcrumbItem className="min-w-0 overflow-hidden">
                            {item.href ? (
                                <>
                                    <p
                                        title={item.label}
                                        className="max-w-20 truncate md:max-w-none cursor-pointer hover:text-foreground transition"
                                        onClick={() => {
                                            setPath(item.href)
                                        }}
                                    >
                                        {item.label}
                                    </p>
                                </>
                            ) : (
                                <BreadcrumbPage className="max-w-20 truncate md:max-w-none">
                                    {item.label}
                                </BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                        {index !== slicedItems.length - 1 ? <BreadcrumbSeparator /> : null}
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
