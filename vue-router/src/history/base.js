/* @flow */

import type VueRouter from '../index'
import { warn } from '../util/warn'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { START, isSameRoute } from '../util/route'
import { _Vue } from '../install'

export class History {
  router: VueRouter;
  base: string;
  current: Route;
  pending: ?Route;
  cb: (r: Route) => void;

  // implemented by sub-classes
  go: (n: number) => void;
  push: (loc: RawLocation) => void;
  replace: (loc: RawLocation) => void;
  ensureURL: (push?: boolean) => void;

  constructor(router: VueRouter, base: ?string) {
    this.router = router
    this.base = normalizeBase(base)
    // start with a route object that stands for "nowhere"
    this.current = START
    this.pending = null
  }

  listen(cb: Function) {
    this.cb = cb
  }

  transitionTo(location: RawLocation, cb?: Function) {
    // 调用match匹配函数,得到location相匹配的路由对象,这里获得的路由对象是包含matched属性的,即路径匹配的所有层级的路由对象
    const route = this.router.match(location, this.current)
    // 确认进行过渡操作
    this.confirmTransition(route, () => {
      // 更新当前路由this.current
      this.updateRoute(route)
      cb && cb(route)
      /*
        子类实现更新url地址
        对于hash模式(HashHistory对象) 就是更新hash的值
        对于history模式(HTML5History对象) 就是利用pushState/replaceState更新浏览器地址
      */
      this.ensureURL()
    })
  }
  // 确认过渡
  confirmTransition(route: Route, cb: Function) {
    const current = this.current
    // 如果当前location匹配的路由对象和当前路由对象相同则直接返回
    if (isSameRoute(route, current)) {
      this.ensureURL()
      return
    }
    /*
    交叉对比current和当前location的路由对象的matched情况,得到需要更新的路由对象
    ep: 从 /basic/father1/son1 跳转到 /basic/father2/son1
    得到的需要卸载的路由对象(deactivated)是son1,father1
    需要加载的路由对象(activated)是father2,son2
     */
    const {
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)
    // 整个路由切换周期的队列
    const queue: Array<?NavigationGuard> = [].concat(
      // 要卸载的路由的beforeRouteLeave 钩子
      extractLeaveGuards(deactivated),
      // 全局路由的before钩子
      this.router.beforeHooks,
      // 要加载的路由的beforeEnter 钩子
      activated.map(m => m.beforeEnter),
      // 异步组件
      resolveAsyncComponents(activated)
    )

    this.pending = route
    // 每一个队列执行的 iterator 函数
    const iterator = (hook: NavigationGuard, next) => {
      // 确保执行期间还是当前路由
      if (this.pending !== route) return
      // 调用钩子
      hook(route, current, (to: any) => {
        // 如果to传入的是false,则表明要终止本次路由切换
        if (to === false) {
          // 终止路由切换,确保当前url正确
          this.ensureURL(true)
        } else if (typeof to === 'string' || typeof to === 'object') {
          // 如果传入的是字符串或者对象,会认为是一个重定向操作,直接调用push
          // next('/') or next({ path: '/' }) -> redirect
          this.push(to)
        } else {
          // confirm transition and pass on the value
          // 其他情况 意味着此次路由切换没有问题 继续队列下一个
          // 且把值传入了
          // 传入的这个值 在此时的 leave 的情况下是没用的
          // 注意：这是为了后边 enter 的时候在处理 beforeRouteEnter 钩子的时候
          // 可以传入一个函数 用于获得组件实例
          next(to)
        }
      })
    }
    // 执行队列
    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      // 执行组件的路由相关的钩子函数
      const enterGuards = extractEnterGuards(activated, postEnterCbs, () => {
        return this.current === route
      })
      // wait until async components are resolved before
      // extracting in-component enter guards
      runQueue(enterGuards, iterator, () => {
        if (this.pending === route) {
          this.pending = null
          cb(route)
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => cb())
          })
        }
      })
    })
  }
  // 更新当前路由对象
  updateRoute(route: Route) {
    const prev = this.current
    this.current = route
    this.cb && this.cb(route)
    this.router.afterHooks.forEach(hook => {
      hook && hook(route, prev)
    })
  }
}

function normalizeBase(base: ?string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = baseEl ? baseEl.getAttribute('href') : '/'
    } else {
      base = '/'
    }
  }
  // 确保base以 / 开头
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // 移除base中末尾的 /
  return base.replace(/\/$/, '')
}

function resolveQueue(
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  // 取得最大深度
  const max = Math.max(current.length, next.length)
  // 从根路由开始匹配,一旦发现不一样了 就停止
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  // 舍弃掉相同的部分,保留不同的部分 会调用这些不同部分的一些钩子函数
  return {
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}
// 获取组件定义时的 key 值
function extractGuard(
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // 对象的话 为了应用上全局的 mixins 这里 extend 下
    // 赋值 def 为 Vue “子类”
    def = _Vue.extend(def)
  }
  // 获取options上的key值
  return def.options[key]
}

function extractLeaveGuards(matched: Array<RouteRecord>): Array<?Function> {
  // 获取leave组件的beforeRouteLeave的钩子函数组成的数组
  // 将他们打平成一纬数组,然后再reverse,因为leave的过程是从内层组件到外层组件的顺序
  return flatten(flatMapComponents(matched, (def, instance) => {
    // 组件配置的 beforeRouteLeave 钩子
    const guard = extractGuard(def, 'beforeRouteLeave')
    if (guard) {
      // 对每个钩子函数再包裹一次
      return Array.isArray(guard)
        ? guard.map(guard => wrapLeaveGuard(guard, instance))
        : wrapLeaveGuard(guard, instance)
    }
  }).reverse())
}

function wrapLeaveGuard(
  guard: NavigationGuard,
  instance: _Vue
): NavigationGuard {
  // 返回函数 执行的时候 用于保证上下文 是当前的组件实例 instance
  return function routeLeaveGuard() {
    return guard.apply(instance, arguments)
  }
}

function extractEnterGuards(
  matched: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  return flatten(flatMapComponents(matched, (def, _, match, key) => {
    const guard = extractGuard(def, 'beforeRouteEnter')
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => wrapEnterGuard(guard, cbs, match, key, isValid))
        : wrapEnterGuard(guard, cbs, match, key, isValid)
    }
  }))
}

function wrapEnterGuard(
  guard: NavigationGuard,
  cbs: Array<Function>,
  match: RouteRecord,
  key: string,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard(to, from, next) {
    return guard(to, from, cb => {
      next(cb)
      if (typeof cb === 'function') {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          poll(cb, match.instances, key, isValid)
        })
      }
    })
  }
}

function poll(
  cb: any, // somehow flow cannot infer this is a function
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if (instances[key]) {
    cb(instances[key])
  } else if (isValid()) {
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}

function resolveAsyncComponents(matched: Array<RouteRecord>): Array<?Function> {
  return flatMapComponents(matched, (def, _, match, key) => {
    // if it's a function and doesn't have Vue options attached,
    // assume it's an async component resolve function.
    // we are not using Vue's default async resolving mechanism because
    // we want to halt the navigation until the incoming component has been
    // resolved.
    if (typeof def === 'function' && !def.options) {
      return (to, from, next) => {
        const resolve = resolvedDef => {
          match.components[key] = resolvedDef
          next()
        }

        const reject = reason => {
          warn(false, `Failed to resolve async component ${key}: ${reason}`)
          next(false)
        }

        const res = def(resolve, reject)
        if (res && typeof res.then === 'function') {
          res.then(resolve, reject)
        }
      }
    }
  })
}

// 将匹配到的组件们根据fn得到的钩子函数们打平
function flatMapComponents(
  matched: Array<RouteRecord>,
  fn: Function
): Array<?Function> {
  // 遍历匹配到的路由记录
  return flatten(matched.map(m => {
    // 遍历 components 配置的组件们
    // 对于默认视图模式下，会包含 default （也就是实例化路由的时候传入的 component 的值）
    // 如果说多个命名视图的话 就是配置的对应的 components 的值
    // 调用 fn 得到 guard 钩子函数的值
    // 注意此时传入的值分别是：视图对应的组件类，对应的组件实例，路由记录，当前 key 值 （命名视图 name 值）
    return Object.keys(m.components).map(key => fn(
      m.components[key],
      m.instances[key],
      m, key
    ))
  }))
}

// 将一个二维数组(伪)转化成一个一维数组
// [[1],2,3,4,[5,6]] -> [1,2,3,4,5,6]
function flatten(arr) {
  return Array.prototype.concat.apply([], arr)
}
