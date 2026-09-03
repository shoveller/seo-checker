import {tool} from "ai";
import type {Page} from "@cloudflare/puppeteer";
import {z} from "zod";

type PuppeteerToolDependencies = {
    getPage: () => Promise<Page>
    closeBrowser: () => Promise<void>
    saveScreenshot: (data: Uint8Array) => Promise<string>
}

export const createPuppeteerTools = ({getPage, closeBrowser, saveScreenshot}: PuppeteerToolDependencies) => {
    return {
        navigate: tool({
            description: '웹 페이지로 이동',
            inputSchema: z.object({ url: z.string().meta({ description: 'https:// 로 시작하는 웹페이지 주소' }) }),
            outputSchema: z.object({
                ok: z.boolean(),
                title: z.string()
            }),
            execute: async ({ url }) => {
                const page = await getPage()
                await page.goto(url)
                return { ok: true, title: await page.title() }
            }
        }),
        inspectSeo: tool({
            description: '현재 페이지의 실제 DOM에서 SEO 항목 8개를 검사하고 코드로 계산한 점수를 반환',
            inputSchema: z.object({}),
            outputSchema: z.object({
                score: z.number(),
                passedChecks: z.number(),
                totalChecks: z.literal(8),
                checks: z.array(z.object({
                    id: z.string(),
                    label: z.string(),
                    passed: z.boolean(),
                    actual: z.unknown()
                }))
            }),
            execute: async () => {
                const page = await getPage()
                const checks = await page.evaluate(() => {
                    type PageElement = {
                        textContent: string | null
                        getAttribute: (name: string) => string | null
                        hasAttribute: (name: string) => boolean
                    }
                    type PageDocument = {
                        querySelector: (selector: string) => PageElement | null
                        querySelectorAll: (selector: string) => ArrayLike<PageElement>
                        documentElement: PageElement
                    }
                    const pageDocument = (globalThis as unknown as {document: PageDocument}).document
                    const title = pageDocument.querySelector('title')?.textContent?.trim() ?? null
                    const description = pageDocument.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? null
                    const headings = Array.from(pageDocument.querySelectorAll('h1'), heading => heading.textContent?.trim() ?? '')
                    const images = Array.from(pageDocument.querySelectorAll('img'))
                    const imagesMissingAlt = images
                        .filter(image => !image.hasAttribute('alt'))
                        .map(image => image.getAttribute('src'))
                    const ogTitle = pageDocument.querySelector('meta[property="og:title"]')
                    const ogImage = pageDocument.querySelector('meta[property="og:image"]')
                    const canonical = pageDocument.querySelector('link[rel="canonical"]')
                    const viewport = pageDocument.querySelector('meta[name="viewport"]')
                    const html = pageDocument.documentElement

                    return [
                        {
                            id: 'title',
                            label: '<title>이 존재하고 10~60자인가',
                            passed: title !== null && title.length >= 10 && title.length <= 60,
                            actual: {value: title, length: title?.length ?? 0}
                        },
                        {
                            id: 'description',
                            label: '<meta name="description">이 존재하고 50~160자인가',
                            passed: description !== null && description.length >= 50 && description.length <= 160,
                            actual: {value: description, length: description?.length ?? 0}
                        },
                        {
                            id: 'h1',
                            label: '페이지에 <h1>이 정확히 하나인가',
                            passed: headings.length === 1,
                            actual: {count: headings.length, values: headings}
                        },
                        {
                            id: 'imageAlt',
                            label: '모든 <img>에 alt 속성이 있는가',
                            passed: imagesMissingAlt.length === 0,
                            actual: {total: images.length, missingAlt: imagesMissingAlt}
                        },
                        {
                            id: 'openGraph',
                            label: '<meta property="og:title">과 <meta property="og:image">가 존재하는가',
                            passed: ogTitle !== null && ogImage !== null,
                            actual: {
                                title: ogTitle?.getAttribute('content') ?? null,
                                image: ogImage?.getAttribute('content') ?? null
                            }
                        },
                        {
                            id: 'canonical',
                            label: '<link rel="canonical">이 존재하는가',
                            passed: canonical !== null,
                            actual: canonical?.getAttribute('href') ?? null
                        },
                        {
                            id: 'viewport',
                            label: '<meta name="viewport">가 존재하는가',
                            passed: viewport !== null,
                            actual: viewport?.getAttribute('content') ?? null
                        },
                        {
                            id: 'language',
                            label: '<html>에 lang 속성이 있는가',
                            passed: html.hasAttribute('lang'),
                            actual: html.getAttribute('lang')
                        }
                    ]
                })
                const passedChecks = checks.filter(check => check.passed).length

                return {
                    score: passedChecks * 12.5,
                    passedChecks,
                    totalChecks: 8 as const,
                    checks
                }
            }
        }),
        screenshot: tool({
            description: '현재 페이지의 스크린샷을 저장하고 조회 경로를 반환',
            inputSchema: z.object({}),
            outputSchema: z.object({
                path: z.string()
            }),
            execute: async () => {
                const page = await getPage()
                const data = await page.screenshot({type: 'png'})
                const path = await saveScreenshot(data)

                return {path}
            }
        }),
        closeBrowser: tool({
            description: "Close the browser session",
            inputSchema: z.object({}),
            outputSchema: z.object({ok: z.boolean()}),
            execute: async () => {
                await closeBrowser();
                return { ok: true };
            },
        })
    }
}
