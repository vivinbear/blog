/* @flow */

import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'

export function normalizeLocation(
  raw: RawLocation,
  current?: Route,
  append?: boolean
): Location {
  const next: Location = typeof raw === 'string' ? { path: raw } : raw
  if (next.name || next._normalized) {
    return next
  }
  // 将location(当前浏览器的url)里的query,hash和path解析出来
  const parsedPath = parsePath(next.path || '')
  const basePath = (current && current.path) || '/'
  // 将当前url的path和当前路由的path结合
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append)
    : (current && current.path) || '/'
  // 处理url的query
  const query = resolveQuery(parsedPath.query, next.query)
  // 处理url的hash
  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }
  // 将当前路由标记为已标准化,并返回标准化后的query,path和hash
  return {
    _normalized: true,
    path,
    query,
    hash
  }
}
