/* @flow */

import { assert, warn } from './util/warn'
import { cleanPath } from './util/path'

/*
  入参
  routes: [
    { path: '/', component: Home, name: 'home' },
    { path: '/foo', component: Foo, name: 'foo' },
    { path: '/bar', component: Bar, name: 'bar' }
  ]
 */
export function createRouteMap(routes: Array<RouteConfig>): {
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
  // 先生成pathMap和nameMap对象({})
  const pathMap: Dictionary<RouteRecord> = Object.create(null)
  const nameMap: Dictionary<RouteRecord> = Object.create(null)
  // 遍历路由,为每一层的每一个路由生成路由record
  routes.forEach(route => {
    addRouteRecord(pathMap, nameMap, route)
  })

  return {
    pathMap,
    nameMap
  }
}

function addRouteRecord(
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  const { path, name } = route
  assert(path != null, `"path" is required in a route configuration.`)

  const record: RouteRecord = {
    path: normalizePath(path, parent),
    components: route.components || { default: route.component },
    instances: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {}
  }
  // 如果有嵌套路由,则循环生成Record
  if (route.children) {
    if (process.env.NODE_ENV !== 'production') {
      if (route.name && route.children.some(child => /^\/?$/.test(child.path))) {
        warn(false, `Named Route '${route.name}' has a default child route.
          When navigating to this named route (:to="{name: '${route.name}'"), the default child route will not be rendered.
          Remove the name from this route and use the name of the default child route for named links instead.`
        )
      }
    }
    route.children.forEach(child => {
      addRouteRecord(pathMap, nameMap, child, record)
    })
  }
  // 处理别名 alias 逻辑 增加对应的 记录
  if (route.alias !== undefined) {
    if (Array.isArray(route.alias)) {
      route.alias.forEach(alias => {
        addRouteRecord(pathMap, nameMap, { path: alias }, parent, record.path)
      })
    } else {
      addRouteRecord(pathMap, nameMap, { path: route.alias }, parent, record.path)
    }
  }
  // 更新pathMap
  pathMap[record.path] = record
  // 更新nameMap
  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record
    } else {
      warn(false, `Duplicate named routes definition: { name: "${name}", path: "${record.path}" }`)
    }
  }
}

function normalizePath(path: string, parent?: RouteRecord): string {
  // 将结尾的/去掉 ep: /base/bar/ -> /base/bar
  path = path.replace(/\/$/, '')
  // 判断是不是根路由起始的路由 ep: path='/base/bar' -> path[0] '/'
  if (path[0] === '/') return path
  if (parent == null) return path
  // cleanPath的作用是将//处理为/ ep: /base//bar -> /base/bar
  return cleanPath(`${parent.path}/${path}`)
}
