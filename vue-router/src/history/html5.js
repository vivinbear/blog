/* @flow */

import type VueRouter from '../index'
import { assert } from '../util/warn'
import { cleanPath } from '../util/path'
import { History } from './base'
import {
  saveScrollPosition,
  getScrollPosition,
  isValidPosition,
  normalizePosition,
  getElementPosition
} from '../util/scroll-position'
// 生成唯一 key 作为页面滚轮位置缓存的key
const genKey = () => String(Date.now())
let _key: string = genKey()

export class HTML5History extends History {
  constructor(router: VueRouter, base: ?string) {
    super(router, base)

    const expectScroll = router.options.scrollBehavior
    // 监听popstate事件,当浏览器记录发生改变的时候(点击浏览器前进、后退按钮或者调用history api的时候)会触发
    window.addEventListener('popstate', e => {
      // 取得state中保存的key
      _key = e.state && e.state.key
      // 获取当前路由对象
      const current = this.current
      this.transitionTo(getLocation(this.base), next => {
        if (expectScroll) {
          // 处理滚动 使滚轮滚动到之前的位置
          this.handleScroll(next, current, true)
        }
      })
    })

    if (expectScroll) {
      // 记录滚动行为 监听滚动事件 记录位置
      window.addEventListener('scroll', () => {
        saveScrollPosition(_key)
      })
    }
  }

  go(n: number) {
    window.history.go(n)
  }

  push(location: RawLocation) {
    const current = this.current
    this.transitionTo(location, route => {
      // 调用 pushState 但是url是base+fullPath,因为fullPath是不带base的
      pushState(cleanPath(this.base + route.fullPath))
      // 处理滚动
      this.handleScroll(route, current, false)
    })
  }

  replace(location: RawLocation) {
    const current = this.current
    this.transitionTo(location, route => {
      // 调用replaceState
      replaceState(cleanPath(this.base + route.fullPath))
      // 处理滚动
      this.handleScroll(route, current, false)
    })
  }
  // 确保location和当前路由对象(this.current)是同步的
  ensureURL(push?: boolean) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  // 处理滚动
  handleScroll(to: Route, from: Route, isPop: boolean) {
    const router = this.router
    if (!router.app) {
      return
    }
    // 自定义滚动行为
    const behavior = router.options.scrollBehavior
    if (!behavior) {
      // 不存在直接返回了
      return
    }
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)

    // 等待下重新渲染逻辑
    router.app.$nextTick(() => {
      // 得到key对应位置
      let position = getScrollPosition(_key)
      // 根据自定义滚动行为函数来判断是否应该滚动
      const shouldScroll = behavior(to, from, isPop ? position : null)
      if (!shouldScroll) {
        return
      }
      // 应该滚动
      const isObject = typeof shouldScroll === 'object'
      if (isObject && typeof shouldScroll.selector === 'string') {
        // 带有 selector 得到该元素
        const el = document.querySelector(shouldScroll.selector)
        if (el) {
          // 得到该元素位置
          position = getElementPosition(el)
        } else if (isValidPosition(shouldScroll)) {
          // 元素不存在 降级下
          position = normalizePosition(shouldScroll)
        }
      } else if (isObject && isValidPosition(shouldScroll)) {
        // 对象 且是合法位置 统一格式
        position = normalizePosition(shouldScroll)
      }

      if (position) {
        // 滚动到指定位置
        window.scrollTo(position.x, position.y)
      }
    })
  }
}
/*
 入参:当前路由的基本路径
 */
export function getLocation(base: string): string {
  // 获取浏览器当前的完整路径
  let path = window.location.pathname
  // 如果基本路径和当前完整路径的开始部分重合,则从完整路径中剔除基本路径
  // base=/basic path=/basic/bar -> path=/bar
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)
  }
  // 添加search和hash
  return (path || '/') + window.location.search + window.location.hash
}

function pushState(url: string, replace?: boolean) {
  // 加了 try...catch 是因为 Safari 有调用 pushState 100 次限制
  // 一旦达到就会抛出 DOM Exception 18 错误
  const history = window.history
  try {
    // 如果是 replace 则调用 history 的 replaceState 操作
    // 否则则调用 pushState
    if (replace) {
      // replace 的话 key 还是当前的 key 没必要生成新的
      // 因为被替换的页面是进入不了的
      history.replaceState({ key: _key }, '', url)
    } else {
      // 重新生成key
      _key = genKey()
      history.pushState({ key: _key }, '', url)
    }
    // 保存 key 对应的位置
    saveScrollPosition(_key)
  } catch (e) {
    // 达到限制了 则重新指定新的地址
    window.location[replace ? 'assign' : 'replace'](url)
  }
}

function replaceState(url: string) {
  pushState(url, true)
}
