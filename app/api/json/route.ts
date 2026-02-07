import { NextRequest, NextResponse } from "next/server"
import { fetchRepos } from "../github"
import { resolveRepos } from "../resolve-repos"

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const repos = await resolveRepos(searchParams)
    const maxPages = parseInt(searchParams.get("pages") || "1")

    const users = await fetchRepos(repos, maxPages)
    return NextResponse.json(users)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
