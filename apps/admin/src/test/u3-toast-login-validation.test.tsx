import i18n from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import { AuthProvider } from "@/hooks/useAuth"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import Login from "@/routes/login"
import { zodResolver } from "@hookform/resolvers/zod"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { MemoryRouter } from "react-router-dom"
import { toast } from "sonner"
import { SWRConfig } from "swr"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"

afterEach(async () => {
    toast.dismiss()
    cleanup()
    vi.restoreAllMocks()
    await i18n.changeLanguage("en")
})

describe("U3: localized validation, login inline alert, toast offset & retry dismissal, and invalid field focus", () => {
    test("Zod validation errors localize across en, zh-CN, zh-TW, and ja without raw 'Too small' jargon", async () => {
        const schema = z.object({
            name: z.string().min(1),
            password: z.string().min(8),
            url: z.string().url(),
            duration: z.number().min(30),
        })

        for (const lng of ["en", "zh-CN", "zh-TW", "ja"] as const) {
            await i18n.changeLanguage(lng)
            const res = schema.safeParse({ name: "", password: "short", url: "not-a-url", duration: 5 })
            expect(res.success).toBe(false)
            const messages = res.error!.issues.map((i) => i.message)
            for (const msg of messages) {
                expect(msg).not.toContain("Too small: expected")
            }
            if (lng !== "en") {
                for (const msg of messages) {
                    expect(msg).not.toMatch(/^Invalid URL$|^Too small/i)
                }
            }
        }
    })

    test("Login surfaces inline role=alert error on HTTP/2 401 (empty statusText) and updates validation language dynamically", async () => {
        await i18n.changeLanguage("zh-CN")
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            const url = String(input)
            if (url.includes("/api/v1/login")) {
                return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
                    status: 401,
                    statusText: "",
                    headers: { "Content-Type": "application/json" },
                })
            }
            if (url.includes("/api/v1/setting")) {
                return new Response(
                    JSON.stringify({ success: true, data: { config: { site_name: "Nezha" } } }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                )
            }
            return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
                status: 401,
                statusText: "",
            })
        })

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <MemoryRouter initialEntries={["/dashboard/login"]}>
                    <AuthProvider>
                        <Login />
                    </AuthProvider>
                </MemoryRouter>
            </SWRConfig>,
        )

        // Dynamic language validation check
        fireEvent.click(screen.getByRole("button", { name: i18n.t("Login") }))
        expect(await screen.findByText(i18n.t("Results.UsernameMin", { number: 2 }))).toBeTruthy()

        // Valid credentials shape -> 401 from backend -> inline alert must appear inside Login card
        const inputs = document.querySelectorAll('input[placeholder="admin"]')
        fireEvent.change(inputs[0]!, { target: { value: "admin" } })
        fireEvent.change(inputs[1]!, { target: { value: "wrongpass" } })
        fireEvent.click(screen.getByRole("button", { name: i18n.t("Login") }))

        const alert = await screen.findByRole("alert")
        expect(alert.textContent).toContain(i18n.t("InvalidUsernameOrPassword"))
    })

    test("useSubmitLock dismisses stale toasts on retry and Toaster offsets above dialog footer", async () => {
        const dismissSpy = vi.spyOn(toast, "dismiss")

        function RetryProbe({ onRun }: { onRun: () => Promise<void> }) {
            const { runSubmit } = useSubmitLock()
            return (
                <>
                    <Toaster />
                    <button type="button" onClick={() => void runSubmit(onRun)()}>
                        Save
                    </button>
                </>
            )
        }

        const runner = vi
            .fn<() => Promise<void>>()
            .mockImplementationOnce(async () => {
                toast.error("First failure")
            })
            .mockImplementationOnce(async () => {
                toast.success("Saved")
            })

        render(<RetryProbe onRun={runner} />)
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }))
        })
        const callsAfterFirst = dismissSpy.mock.calls.length
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }))
        })
        expect(dismissSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)

        const toaster = await waitFor(() => {
            const el = document.querySelector("[data-sonner-toaster]") as HTMLElement | null
            expect(el).toBeTruthy()
            return el!
        })
        expect(toaster.style.getPropertyValue("--offset-bottom") || toaster.style.bottom).toContain(
            "5.5rem",
        )
    })

    test("submitting dialog form with visible invalid field keeps focus on invalid control and scrolls its label into view", async () => {
        const schema = z.object({
            name: z.string().min(1),
            domains_json: z.string().refine(
                (v) => {
                    try {
                        JSON.parse(v)
                        return true
                    } catch {
                        return false
                    }
                },
                { error: () => "Invalid JSON" },
            ),
        })

        function DialogFormProbe() {
            const form = useForm<z.infer<typeof schema>>({
                resolver: zodResolver(schema),
                defaultValues: { name: "tokyo-node", domains_json: "{broken" },
            })
            return (
                <Dialog open>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Server</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(() => undefined)}>
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="domains_json"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Override DDNS Domains</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="submit">Submit</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            )
        }

        render(<DialogFormProbe />)
        const dialog = await screen.findByRole("dialog")
        const textarea = dialog.querySelector('textarea[name="domains_json"]') as HTMLTextAreaElement
        const item = textarea.closest("[data-form-item]") as HTMLElement | null

        // Simulate scrolled dialog where label is clipped above top of dialog
        dialog.scrollTop = 240
        vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
            top: 0,
            bottom: 667,
            left: 0,
            right: 375,
            width: 375,
            height: 667,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        })
        vi.spyOn(textarea, "getBoundingClientRect").mockReturnValue({
            top: 10,
            bottom: 90,
            left: 24,
            right: 351,
            width: 327,
            height: 80,
            x: 24,
            y: 10,
            toJSON: () => ({}),
        })
        if (item) {
            vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
                top: -22,
                bottom: 118,
                left: 24,
                right: 351,
                width: 327,
                height: 140,
                x: 24,
                y: -22,
                toJSON: () => ({}),
            })
        }

        await act(async () => {
            fireEvent.submit(dialog.querySelector("form")!)
        })

        expect(item).toBeTruthy()
        expect(document.activeElement).toBe(textarea)
        await waitFor(() => expect(dialog.scrollTop).toBeLessThan(240))
    })
})
