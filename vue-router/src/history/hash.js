/* @flow */

import type VueRouter from '../index'
import { History } from './base'
import { getLocation } from './html5'
import { cleanPath } from '../util/path'

export class HashHistory extends History {
  constructor (router: VueRouter, base: ?string, fallback: boolean) {
    super(router, base)

    // 如果说是从history模式降级来的,需要做降级检查
    if (fallback && this.checkFallback()) {
      // 如果降级且进行了降级处理,则返回
      return
    }
    // 确保hash模式下url是以 / 开头
    ensureSlash()
  }

  checkFallback () {
    // 得到去除base的location的值
    const location = getLocation(this.base)
    // 如果此时的地址不是以 /# 开头,需要进行降级处理,降级为hash模式下的以 /# 开头
    if (!/^\/#/.test(location)) {
      window.location.replace(
        cleanPath(this.base + '/#' + location)
      )
      return true
    }
  }

  onHashChange () {
    // 判断url是否以 / 开头
    if (!ensureSlash()) {
      return
    }
    // 调用transitionTo
    this.transitionTo(getHash(), route => {
      // 替换hash
      replaceHash(route.fullPath)
    })
  }

  push (location: RawLocation) {
    this.transitionTo(location, route => {
      pushHash(route.fullPath)
    })
  }

  replace (location: RawLocation) {
    this.transitionTo(location, route => {
      replaceHash(route.fullPath)
    })
  }

  go (n: number) {
    window.history.go(n)
  }

  ensureURL (push?: boolean) {
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }
}

function ensureSlash (): boolean {
  // 得到hash值
  const path = getHash()
  // 如果说hash值以 / 开头,则返回
  if (path.charAt(0) === '/') {
    return true
  }
  // 如果不是的话,手动进行一次替换,保证hash值以/开头
  replaceHash('/' + path)
  return false
}

export function getHash (): string {
  // 因为兼容性问题 这里没有直接使用 window.location.hash
  // 因为 Firefox decode hash 值
  const href = window.location.href
  const index = href.indexOf('#')
  return index === -1 ? '' : href.slice(index + 1)
}

function pushHash (path) {
  window.location.hash = path
}

function replaceHash (path) {
  const i = window.location.href.indexOf('#')
  // 直接调用 replace 强制替换 以避免产生“多余”的历史记录
  // 主要是用户初次跳入 且hash值不是以 / 开头的时候直接替换
  // 其余时候和push没啥区别 浏览器总是记录hash记录
  window.location.replace(
    window.location.href.slice(0, i >= 0 ? i : 0) + '#' + path
  )
}
