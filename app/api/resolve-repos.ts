type GhRepo = {
  name: string
  private: boolean
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const m = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return m?.[1] ?? null
}

export async function fetchOrgRepos(org: string): Promise<string[]> {
  // validate org
  if (!/^[\w-]+$/.test(org)) {
    throw new Error(`invalid org: ${org}`)
  }

  const headers: HeadersInit = {}
  if (process.env.PAT) {
    headers["Authorization"] = `Bearer ${process.env.PAT}`
  }

  let url: string | null = `https://api.github.com/orgs/${org}/repos?per_page=100&type=public`
  const out: string[] = []

  while (url) {
    const res = await fetch(url, { headers })
    if (res.status >= 400) {
      let detail = `${res.status}`
      try {
        const body = (await res.json()) as { message?: string }
        if (body.message) detail += ` ${body.message}`
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(`failed to list org repos [${org}]: ${detail}`)
    }

    const data = (await res.json()) as GhRepo[]
    for (const r of data) {
      if (r.private) continue
      out.push(`${org}/${r.name}`)
    }

    url = parseNextLink(res.headers.get("link"))
    // hard limit to prevent accidental abuse
    if (out.length > 500) break
  }

  return out
}

/**
 * Resolve repos from search params, supporting `repo`, `org`, and `exclude` params.
 */
export async function resolveRepos(searchParams: URLSearchParams): Promise<string[]> {
  const reposFromQuery = searchParams.getAll("repo")
  const org = searchParams.get("org")

  const exclude = new Set(
    searchParams
      .getAll("exclude")
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean)
  )

  let repos: string[] = [...reposFromQuery]
  if (org) {
    repos = [...(await fetchOrgRepos(org)), ...repos]
  }

  // de-dupe + apply exclude filters
  repos = Array.from(new Set(repos)).filter((full) => {
    const [, name] = full.split("/")
    return !exclude.has(full) && !exclude.has(name)
  })

  if (repos.length === 0) {
    throw new Error("repo or org is required")
  }

  return repos
}
