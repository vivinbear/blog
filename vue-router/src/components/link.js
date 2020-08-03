/* @flow */

import { cleanPath } from '../util/path'
import { createRoute, isSameRoute, isIncludedRoute } from '../util/route'
import { normalizeLocation } from '../util/location'
import { _Vue } from '../install'

// work around weird flow bug
const toTypes: Array<Function> = [String, Object]

// 可以看出 router-link 组件就是在其点击的时候根据设置的 to 的值去调用 router 的 push 或者 replace 来更新路由的，同时呢，会检查自身是否和当前路由匹配（严格匹配和包含匹配）来决定自身的 activeClass 是否添加。

export default {
  name: 'router-link',
  props: {
    // 传入的组件属性们
    to: { // 目标路由的链接
      type: toTypes,
      required: true
    },
    // 创建的html标签
    tag: {
      type: String,
      default: 'a'
    },
    // 完整模式，如果为 true 那么也就意味着
    // 绝对相等的路由才会增加 activeClass
    // 否则是包含关系
    exact: Boolean,
    // 在当前（相对）路径附加路径
    append: Boolean,
    // 如果为 true 则调用 router.replace() 做替换历史操作
    replace: Boolean,
    // 链接激活时使用的 CSS 类名
    activeClass: String
  },
  render(h: Function) {
    // 得到 router 实例以及当前激活的 route 对象
    const router = this.$router
    const current = this.$route
    const to = normalizeLocation(this.to, current, this.append)
    // 根据当前目标链接和当前激活的 route匹配结果
    const resolved = router.match(to, current)
    const fullPath = resolved.redirectedFrom || resolved.fullPath
    const base = router.history.base
    // 创建的 href
    const href = createHref(base, fullPath, router.mode)
    const classes = {}
    // 激活class 优先当前组件上获取 要么就是 router 配置的 linkActiveClass
    // 默认 router-link-active
    const activeClass = this.activeClass || router.options.linkActiveClass || 'router-link-active'
    // 相比较目标
    // 因为有命名路由 所有不一定有path
    const compareTarget = to.path ? createRoute(null, to) : resolved
    // 如果严格模式的话 就判断是否是相同路由（path query params hash）
    // 否则就走包含逻辑（path包含，query包含 hash为空或者相同）
    classes[activeClass] = this.exact
      ? isSameRoute(current, compareTarget)
      : isIncludedRoute(current, compareTarget)

    // 事件绑定
    const on = {
      click: (e) => {
        // 忽略带有功能键的点击
        if (e.metaKey || e.ctrlKey || e.shiftKey) return
        // 已阻止的返回
        if (e.defaultPrevented) return
        // 右击
        if (e.button !== 0) return
        // `target="_blank"` 忽略
        const target = e.target.getAttribute('target')
        if (/\b_blank\b/i.test(target)) return
        // 阻止默认行为 防止跳转
        e.preventDefault()
        if (this.replace) {
          // replace 逻辑
          router.replace(to)
        } else {
          // push 逻辑
          router.push(to)
        }
      }
    }
    // 创建元素需要附加的数据们
    const data: any = {
      class: classes
    }

    if (this.tag === 'a') {
      data.on = on
      data.attrs = { href }
    } else {
      // 找到第一个 <a> 给予这个元素事件绑定和href属性
      const a = findAnchor(this.$slots.default)
      if (a) {
        // in case the <a> is a static node
        a.isStatic = false
        const extend = _Vue.util.extend
        const aData = a.data = extend({}, a.data)
        aData.on = on
        const aAttrs = a.data.attrs = extend({}, a.data.attrs)
        aAttrs.href = href
      } else {
        // 没有 <a> 的话就给当前元素自身绑定时间
        data.on = on
      }
    }
    // 创建元素
    return h(this.tag, data, this.$slots.default)
  }
}

function findAnchor(children) {
  if (children) {
    let child
    for (let i = 0; i < children.length; i++) {
      child = children[i]
      if (child.tag === 'a') {
        return child
      }
      if (child.children && (child = findAnchor(child.children))) {
        return child
      }
    }
  }
}

function createHref(base, fullPath, mode) {
  var path = mode === 'hash' ? '/#' + fullPath : fullPath
  return base ? cleanPath(base + path) : path
}
