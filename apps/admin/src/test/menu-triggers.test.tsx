import { InstallCommandsMenu } from "@/components/install-commands"
import { ServerConfigCard } from "@/components/server-config"
import { TerminalButton } from "@/components/terminal"
import { DropdownMenu, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, expect, test, vi } from "vitest"

afterEach(cleanup)

test.each([
    { name: "terminal", Component: TerminalButton, props: { id: 1 } },
    { name: "config", Component: ServerConfigCard, props: { sid: 1 } },
    { name: "install", Component: InstallCommandsMenu, props: { uuid: "mock" } },
])("R2-ADM-07: $name forwards menu semantics, events and ref", ({ Component, props }) => {
    const Trigger: React.ElementType = Component
    const ref = createRef<HTMLButtonElement>()
    const keydown = vi.fn()
    render(
        <DropdownMenu open>
            <DropdownMenuContent>
                <Trigger
                    {...props}
                    menuItem
                    ref={ref}
                    role="menuitem"
                    tabIndex={-1}
                    onKeyDown={keydown}
                />
            </DropdownMenuContent>
        </DropdownMenu>,
    )
    const item = screen.getByRole("menuitem")
    expect(ref.current).toBe(item)
    expect(item.tabIndex).toBe(-1)
    fireEvent.keyDown(item, { key: "ArrowDown" })
    expect(keydown).toHaveBeenCalledOnce()
})
